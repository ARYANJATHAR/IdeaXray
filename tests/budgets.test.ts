import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { withTimeBudget } from "@/src/server/analysis/lifecycle";
import { AzureLanguageProvider } from "@/src/server/ai/provider";
import { getServerEnv } from "@/src/server/env";
import { scrubSecrets } from "@/src/server/serpapi/client";
let clockStep = 0;
beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "azure");
  vi.stubEnv("AZURE_OPENAI_API_KEY", "");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "");
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "");
  vi.stubEnv("AZURE_OPENAI_REASONING_EFFORT", "");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(["https://test.openai.azure.com", "https://test.openai.azure.com/openai/v1/"])("uses the Azure deployment and v1 endpoint for %s", async (endpoint) => {
  vi.useFakeTimers({ now: Date.now() + ++clockStep * 60000 });
  vi.stubEnv("AI_PROVIDER", "azure");
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-azure-key");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", endpoint);
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini-1");
  vi.stubEnv("AZURE_OPENAI_REASONING_EFFORT", "low");
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }] })));
  vi.stubGlobal("fetch", fetch);
  const check = expect(new AzureLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
  await vi.advanceTimersByTimeAsync(5000); await check;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toBe("https://test.openai.azure.com/openai/v1/chat/completions");
  expect(fetch.mock.calls[0][1].headers["api-key"]).toBe("test-azure-key");
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body).toMatchObject({ model: "gpt-5-mini-1", response_format: { type: "json_object" }, reasoning_effort: "low", max_completion_tokens: 8192 });
  expect(body).not.toHaveProperty("max_tokens");
});

it.each(["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT"])("requires %s without falling back to other providers", async (missing) => {
  vi.stubEnv("AI_PROVIDER", "azure");
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "ideaxray-mini");
  vi.stubEnv(missing, "");
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(new AzureLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() })))
    .rejects.toMatchObject({ code: "AI_CONFIG", message: expect.stringContaining(missing) });
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["not-a-url", "http://test.openai.azure.com", "https://user:pass@test.openai.azure.com", "https://test.openai.azure.com/?key=secret", "https://test.openai.azure.com/openai/deployments/test"])("rejects an invalid Azure endpoint: %s", (endpoint) => {
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", endpoint);
  expect(() => getServerEnv()).toThrow();
});

it("redacts Azure credentials from stored search text", () => {
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-azure-secret");
  expect(scrubSecrets({ snippet: "key test-azure-secret", api_key: "test-azure-secret" })).toEqual({ snippet: "key [redacted]" });
});

it("enforces a deadline even when underlying work ignores cancellation", async () => {
  await expect(withTimeBudget(10, () => new Promise(() => {}))).rejects.toMatchObject({ code: "AI_BUDGET" });
});
it("does not retry a rate-limited Azure endpoint or expose provider account details", async () => {
  vi.useFakeTimers({ now: Date.now() + ++clockStep * 60000 });
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini-1");
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Rate limit for org_private_account" } }), { status: 429 }));
  vi.stubGlobal("fetch", fetch);
  const result = new AzureLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() }));
  const check = expect(result).rejects.toMatchObject({ code: "AI_UPSTREAM_429", message: expect.stringContaining("usage limit") });
  await vi.advanceTimersByTimeAsync(5000); await check;
  await expect(result).rejects.not.toThrow("org_private_account");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("repairs malformed Azure JSON using only the same deployment", async () => {
  vi.useFakeTimers({ now: Date.now() + ++clockStep * 60000 });
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-key");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini-1");
  const response = (content: string) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }));
  const fetch = vi.fn().mockResolvedValueOnce(response("invalid JSON")).mockResolvedValueOnce(response('{"ok":true}'));
  vi.stubGlobal("fetch", fetch);
  const check = expect(new AzureLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
  await vi.advanceTimersByTimeAsync(5000); await check;
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const call of fetch.mock.calls) expect(String(call[0])).toBe("https://test.openai.azure.com/openai/v1/chat/completions");
});

import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { withTimeBudget } from "@/src/server/analysis/lifecycle";
import { FallbackLanguageProvider } from "@/src/server/ai/provider";
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("enforces a deadline even when underlying work ignores cancellation", async () => {
  await expect(withTimeBudget(10, () => new Promise(() => {}))).rejects.toMatchObject({ code: "AI_BUDGET" });
});
it("moves to the next provider without retrying a rate-limited endpoint", async () => {
  vi.useFakeTimers();
  vi.stubEnv("GROQ_API_KEY", "test"); vi.stubEnv("OPENROUTER_API_KEY", "test");
  vi.stubEnv("GROQ_MODEL", "test-groq"); vi.stubEnv("OPENROUTER_MODEL", "test-router");
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })));
  vi.stubGlobal("fetch", fetch);
  const result = new FallbackLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() }));
  const check = expect(result).resolves.toEqual({ ok: true });
  await vi.advanceTimersByTimeAsync(5000); await check;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(fetch.mock.calls[1][0])).toContain("openrouter.ai");
});

it("does not expose provider account details in public errors", async () => {
  vi.useFakeTimers();
  vi.stubEnv("GROQ_API_KEY", "test"); vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("GROQ_MODEL", "test-groq");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Rate limit for org_private_account" } }), { status: 429 })));
  const result = new FallbackLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() })).catch((error: Error) => error.message);
  await vi.advanceTimersByTimeAsync(5000);
  const message = await result;
  expect(message).toContain("usage limit");
  expect(message).not.toContain("org_private_account");
});


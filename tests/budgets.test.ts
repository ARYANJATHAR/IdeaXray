import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { withTimeBudget } from "@/src/server/analysis/lifecycle";
import { FallbackLanguageProvider } from "@/src/server/ai/provider";
let clockStep = 0;
beforeEach(() => {
  // Do not let local .env credentials trigger network calls in provider unit tests.
  vi.stubEnv("FREEAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("enforces a deadline even when underlying work ignores cancellation", async () => {
  await expect(withTimeBudget(10, () => new Promise(() => {}))).rejects.toMatchObject({ code: "AI_BUDGET" });
});
it("moves to the next provider without retrying a rate-limited endpoint", async () => {
  vi.useFakeTimers({ now: Date.now() + ++clockStep * 60000 });
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
  vi.useFakeTimers({ now: Date.now() + ++clockStep * 60000 });
  vi.stubEnv("GROQ_API_KEY", "test"); vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("GROQ_MODEL", "test-groq");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Rate limit for org_private_account" } }), { status: 429 })));
  const result = new FallbackLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() })).catch((error: Error) => error.message);
  await vi.advanceTimersByTimeAsync(5000);
  const message = await result;
  expect(message).toContain("usage limit");
  expect(message).not.toContain("org_private_account");
});


it("uses Gemini when it is the only configured provider", async () => {
  vi.useFakeTimers({ now: Date.now() + ++clockStep * 60000 });
  vi.stubEnv("GEMINI_API_KEY", "test-google-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })));
  vi.stubGlobal("fetch", fetch);
  const result = new FallbackLanguageProvider().structured("Test", {}, z.object({ ok: z.boolean() }));
  const check = expect(result).resolves.toEqual({ ok: true });
  await vi.advanceTimersByTimeAsync(5000); await check;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
  expect(JSON.parse(fetch.mock.calls[0][1].body).generationConfig.responseMimeType).toBe("application/json");
  expect(fetch.mock.calls[0][1].headers["x-goog-api-key"]).toBe("test-google-key");
});

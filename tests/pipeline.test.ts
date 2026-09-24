import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { db } from "@/src/server/db/client";
import { admitAnalysis } from "@/src/server/analysis/admission";
import { failAnalysis, recoverExpiredAnalyses } from "@/src/server/analysis/lifecycle";
import { startAnalysis } from "@/src/server/analysis/runner";
import { persistReport } from "@/src/server/analysis/persistence";
import { runSearch } from "@/src/server/serpapi/client";
import { languageProvider } from "@/src/server/ai/provider";
import { getAccount, getJson } from "serpapi";
import { report } from "./fixtures";

vi.mock("serpapi", () => ({ getAccount: vi.fn(), getJson: vi.fn() }));
const input = { idea: "A camera backpack that follows people", region: "worldwide" as const };
let databaseFile: string;
beforeAll(() => {
  databaseFile = path.join(mkdtempSync(path.join(tmpdir(), "ideaxray-regression-")), "test.db");
  process.env.DATABASE_URL = "file:" + databaseFile.replaceAll("\\", "/");
  const sqlite = new DatabaseSync(databaseFile);
  for (const directory of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) {
    sqlite.exec(readFileSync(path.join("prisma/migrations", directory, "migration.sql"), "utf8"));
  }
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  sqlite.close();
});
beforeEach(async () => {
  await db().analysis.deleteMany();
  await db().searchCache.deleteMany();
  vi.stubEnv("RATE_LIMIT_PER_HOUR", "10");
  vi.stubEnv("GLOBAL_ANALYSES_PER_HOUR", "20");
  vi.stubEnv("MAX_CONCURRENT_ANALYSES", "2");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await db().$disconnect(); });

describe("database-backed admission", () => {
  it("enforces the shared allowance across new cookie owners", async () => {
    vi.stubEnv("GLOBAL_ANALYSES_PER_HOUR", "2");
    for (let i = 0; i < 2; i++) {
      const item = await admitAnalysis(input, "owner-" + i);
      await failAnalysis(item.id, new Error("Test completed"));
    }
    await expect(admitAnalysis(input, "fresh-cookie")).rejects.toMatchObject({ code: "RATE_LIMIT" });
    expect(await db().analysis.count()).toBe(2);
  });
  it("limits a single owner as well as the shared allowance", async () => {
    vi.stubEnv("RATE_LIMIT_PER_HOUR", "1");
    const item = await admitAnalysis(input, "same-owner");
    await failAnalysis(item.id, new Error("Test completed"));
    await expect(admitAnalysis(input, "same-owner")).rejects.toMatchObject({ code: "RATE_LIMIT" });
    await expect(admitAnalysis(input, "different-owner")).resolves.toBeDefined();
  });
  it("caps concurrent admissions atomically", async () => {
    vi.stubEnv("MAX_CONCURRENT_ANALYSES", "1");
    const outcomes = await Promise.allSettled([admitAnalysis(input, "a"), admitAnalysis(input, "b")]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db().analysis.count({ where: { status: "QUEUED" } })).toBe(1);
  });
  it("does not count runs older than the rolling hour", async () => {
    vi.stubEnv("GLOBAL_ANALYSES_PER_HOUR", "1");
    await db().analysis.create({ data: { originalIdea: input.idea, ownerHash: "old", status: "FAILED", createdAt: new Date(Date.now() - 3600001) } });
    await expect(admitAnalysis(input, "new")).resolves.toBeDefined();
  });
});

describe("job recovery", () => {
  it("expires abandoned jobs without touching live or completed ones", async () => {
    const stale = await db().analysis.create({ data: { originalIdea: input.idea, ownerHash: "a", status: "RUNNING", leaseExpiresAt: new Date(Date.now() - 1000) } });
    const live = await admitAnalysis(input, "b");
    await recoverExpiredAnalyses();
    expect((await db().analysis.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("FAILED");
    expect((await db().analysis.findUniqueOrThrow({ where: { id: live.id } })).status).toBe("QUEUED");
  });
  it("prevents a late worker from publishing after failure", async () => {
    const item = await admitAnalysis(input, "a");
    await failAnalysis(item.id, new Error("Expired"));
    await expect(persistReport(item.id, report([]))).rejects.toMatchObject({ code: "LEASE_LOST" });
    expect((await db().analysis.findUniqueOrThrow({ where: { id: item.id } })).summaryJson).toBeNull();
  });
  it("records initialization failure rather than leaving an active run", async () => {
    const item = await admitAnalysis(input, "a");
    const read = vi.spyOn(db().analysis, "findUniqueOrThrow").mockRejectedValueOnce(new Error("Initialization failed"));
    await startAnalysis(item.id); read.mockRestore();
    expect((await db().analysis.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("FAILED");
  });
});

it("keeps original search IDs when serving the cache", async () => {
  const analysis = await admitAnalysis(input, "a");
  await db().analysis.update({ where: { id: analysis.id }, data: { status: "RUNNING" } });
  vi.mocked(getJson).mockResolvedValue({ search_metadata: { id: "original-serp-id", status: "Success" }, organic_results: [{ title: "Camera backpack" }] });
  const plan = { engine: "google" as const, query: "camera backpack", purpose: "Test", params: { q: "camera backpack" } };
  const first = await runSearch(analysis.id, plan), cached = await runSearch(analysis.id, plan);
  expect(first.trace.serpApiSearchId).toBe("original-serp-id");
  expect(cached.trace.status).toBe("CACHED");
  expect(cached.trace.serpApiSearchId).toBe("original-serp-id");
  expect(cached.trace.attempts).toBe(0);
  expect(vi.mocked(getJson)).toHaveBeenCalledTimes(1);
});

it("completes the full pipeline with source records, product metrics, and a report", async () => {
  vi.stubEnv("SERPAPI_API_KEY", "test-only-key");
  vi.stubEnv("GROQ_API_KEY", "test-only-key");
  vi.mocked(getAccount).mockResolvedValue({ total_searches_left: 100 });
  vi.mocked(getJson).mockImplementation(async (params: unknown) => {
    const engine = String((params as Record<string, unknown>).engine);
    const metadata = { id: "serp-" + engine, status: "Success" };
    const row = { title: "Camera backpack " + engine, snippet: "TrailPack is a camera backpack that follows people.", link: `https://example.com/${engine}` };
    if (engine === "google_trends") return { search_metadata: metadata, interest_over_time: { timeline_data: [] } };
    return { search_metadata: metadata, [engine === "google_news" ? "news_results" : engine === "google_shopping" ? "shopping_results" : "organic_results"]: [row] };
  });
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const ai = vi.spyOn(languageProvider, "structured").mockRejectedValue(new Error("AI must not be needed"));
  const item = await admitAnalysis(input, "pipeline-owner");
  await startAnalysis(item.id);
  const result = await db().analysis.findUniqueOrThrow({ where: { id: item.id } });
  expect(result.status).toBe("COMPLETED");
  expect(result.leaseExpiresAt).toBeNull();
  expect(result.progress).toBe(100);
  expect(await db().searchRun.count({ where: { analysisId: item.id } })).toBe(6);
  expect(await db().evidenceItem.count({ where: { analysisId: item.id, type: "PRODUCT", confidenceScore: null } })).toBe(1);
  expect(result.summaryJson).toMatchObject({ sourceFirst: true, aiEnrichment: false, overview: { PRODUCT: 1 } });
  expect(ai).not.toHaveBeenCalled();
});

it("preserves collected sources as a partial report when optional AI fails", async () => {
  vi.stubEnv("SERPAPI_API_KEY", "test-only-key");
  vi.stubEnv("GROQ_API_KEY", "test-only-key");
  vi.mocked(getAccount).mockResolvedValue({ total_searches_left: 100 });
  vi.mocked(getJson).mockImplementation(async (params: unknown) => {
    const engine = String((params as Record<string, unknown>).engine);
    const metadata = { id: "serp-" + engine, status: "Success" };
    const row = { title: "Camera backpack " + engine, snippet: "TrailPack is a camera backpack that follows people.", link: `https://example.com/${engine}` };
    if (engine === "google_trends") return { search_metadata: metadata, interest_over_time: { timeline_data: [] } };
    return { search_metadata: metadata, [engine === "google_news" ? "news_results" : engine === "google_shopping" ? "shopping_results" : "organic_results"]: [row] };
  });
  vi.stubEnv("AI_ENRICHMENT", "true");
  vi.spyOn(languageProvider, "structured").mockRejectedValue(new Error("Provider unavailable"));
  const item = await admitAnalysis(input, "partial-owner");
  await startAnalysis(item.id);
  const result = await db().analysis.findUniqueOrThrow({ where: { id: item.id } });
  expect(result.status).toBe("PARTIAL");
  expect(result.leaseExpiresAt).toBeNull();
  expect(result.progress).toBe(100);
  expect(await db().searchRun.count({ where: { analysisId: item.id } })).toBe(6);
  expect(await db().evidenceItem.count({ where: { analysisId: item.id } })).toBeGreaterThan(0);
  expect(result.summaryJson).toMatchObject({ findings: [], gaps: [], indicators: expect.arrayContaining([
    expect.objectContaining({ name: "Commercial Activity", value: null }),
    expect.objectContaining({ name: "Landscape Crowding", value: null }),
  ]) });
  expect(result.warningsJson).toEqual(expect.arrayContaining([expect.stringContaining("synthesis incomplete")]));
});

import "server-only";
import { createHash } from "node:crypto";
import { getJson, getAccount } from "serpapi";
import { z } from "zod";
import type { SearchPlanItem, SearchTrace } from "@/src/lib/contracts";
import { officialSearchUrl } from "@/src/lib/search-url";
import { db, json } from "../db/client";
import { getServerEnv } from "../env";
import { AppError, logEvent, publicError } from "../errors";
import { validateResponse } from "./schema";
import { assertJobActive } from "../analysis/lifecycle";

const ttlHours: Record<SearchPlanItem["engine"], number> = { google: 48, google_patents: 168, google_patents_details: 168, google_scholar: 168, google_news: 6, google_shopping: 12, google_trends: 24 };

export function scrubSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/api.?key|authorization|token|password|secret/i.test(key)).map(([key, item]) => [key, scrubSecrets(item)]));
  if (typeof value === "string") {
    let clean = value.replace(/([?&](?:api_key|key|token)=)[^&\s"]+/gi, "$1[redacted]");
    for (const key of [process.env.SERPAPI_API_KEY, process.env.GROQ_API_KEY, process.env.OPENROUTER_API_KEY]) if (key) clean = clean.replaceAll(key, "[redacted]");
    return clean;
  }
  return value;
}

function normalizedError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const internal = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (/api.key|unauthorized|invalid.*key/i.test(internal)) return new AppError("SEARCH_AUTH", "The search API key was rejected.", 503);
  if (/credit|quota|run out|limit exceeded/i.test(internal)) return new AppError("SEARCH_QUOTA", "Search credits or service rate limits were reached.", 503);
  if (/invalid|missing.*parameter|unsupported/i.test(internal)) return new AppError("SEARCH_QUERY", "The search query was rejected.", 502);
  return new AppError("SEARCH_TEMPORARY", "The search service timed out or is temporarily unavailable.", 502, true);
}

export async function checkCredits() {
  assertJobActive();
  const env = getServerEnv();
  try {
    const raw: unknown = await getAccount({ api_key: env.SERPAPI_API_KEY, timeout: env.SEARCH_TIMEOUT_MS });
    const account = z.object({ total_searches_left: z.number().nonnegative() }).safeParse(raw);
    if (!account.success) throw new AppError("ACCOUNT_RESPONSE", "Could not verify available search credits.", 503);
    if (account.data.total_searches_left < env.MIN_SERPAPI_CREDITS) throw new AppError("LOW_CREDITS", "Not enough SerpApi credits to safely start another report.", 503);
  } catch (error) { throw normalizedError(error); }
}

export async function runSearch(analysisId: string, item: SearchPlanItem): Promise<{ raw: Record<string, unknown> | null; trace: SearchTrace }> {
  assertJobActive();
  const started = Date.now();
  const env = getServerEnv();
  const run = await db().searchRun.create({ data: { analysisId, engine: item.engine, query: item.query, purpose: item.purpose, paramsJson: json(item.params), status: "RUNNING" } });
  const trace: SearchTrace = {
    id: run.id, engine: item.engine, query: item.query, purpose: item.purpose, officialUrl: officialSearchUrl(item.engine, item.query, item.params),
    status: "FAILED", resultCount: 0, retainedCount: 0, durationMs: 0, attempts: 0,
  };
  const sortedParams = Object.fromEntries(Object.entries(item.params).sort(([a], [b]) => a.localeCompare(b)));
  const key = createHash("sha256").update(JSON.stringify({ engine: item.engine, params: sortedParams })).digest("hex");
  let raw: Record<string, unknown> | null = null;
  try {
    const cached = await db().searchCache.findUnique({ where: { key } });
    if (cached && cached.expiresAt > new Date()) {
      raw = validateResponse(item.engine, cached.payloadJson);
      trace.status = "CACHED";
    } else {
      for (let attempt = 0; attempt < 2; attempt++) {
        assertJobActive();
        const reserved = await db().analysis.updateMany({ where: { id: analysisId, status: "RUNNING", leaseExpiresAt: { gt: new Date() }, searchAttempts: { lt: env.MAX_SEARCHES_PER_ANALYSIS } }, data: { searchAttempts: { increment: 1 } } });
        if (!reserved.count) throw new AppError("SEARCH_BUDGET", "The search budget was reached.", 429);
        trace.attempts++;
        try {
          const response: unknown = await getJson({ ...item.params, engine: item.engine, api_key: env.SERPAPI_API_KEY, output: "json", timeout: env.SEARCH_TIMEOUT_MS });
          raw = validateResponse(item.engine, scrubSecrets(response));
          trace.status = "COMPLETED";
          await db().searchCache.upsert({
            where: { key },
            create: { key, engine: item.engine, payloadJson: json(raw), expiresAt: new Date(Date.now() + ttlHours[item.engine] * 3600000) },
            update: { payloadJson: json(raw), expiresAt: new Date(Date.now() + ttlHours[item.engine] * 3600000) },
          }).catch(() => logEvent("search_cache_write_failed", { analysisId, engine: item.engine }));
          break;
        } catch (error) {
          const normalized = normalizedError(error);
          if (!normalized.retryable || attempt === 1) throw normalized;
          await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
        }
      }
    }
    if (raw) trace.serpApiSearchId = z.object({ id: z.string() }).parse(raw.search_metadata).id;
  } catch (error) {
    const normalized = normalizedError(error);
    trace.error = publicError(normalized);
    trace.status = normalized.code === "SEARCH_BUDGET" ? "SKIPPED" : "FAILED";
  }
  trace.durationMs = Date.now() - started;
  assertJobActive();
  await db().searchRun.update({ where: { id: run.id }, data: { status: trace.status, durationMs: trace.durationMs, attempts: trace.attempts, error: trace.error, serpApiSearchId: trace.serpApiSearchId, ...(raw ? { rawResponseJson: json(raw) } : {}) } });
  logEvent("search_finished", { analysisId, engine: item.engine, durationMs: trace.durationMs, code: trace.status });
  return { raw, trace };
}

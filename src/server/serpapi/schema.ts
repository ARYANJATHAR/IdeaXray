import { z } from "zod";
import type { Engine } from "@/src/lib/contracts";
import { AppError } from "../errors";
const row = z.object({ title: z.string().optional(), snippet: z.string().optional(), link: z.string().optional() }).passthrough();
const envelope = z.object({ search_metadata: z.object({ id: z.string(), status: z.string() }).passthrough(), error: z.string().optional() }).passthrough();
const rows = z.array(row).optional();
const schemas = {
  google: envelope.extend({ organic_results: rows }),
  google_patents: envelope.extend({ organic_results: rows }),
  google_scholar: envelope.extend({ organic_results: rows }),
  google_news: envelope.extend({ news_results: rows }),
  google_shopping: envelope.extend({ shopping_results: rows, inline_shopping_results: rows }),
  google_trends: envelope.extend({ interest_over_time: z.object({ timeline_data: z.array(z.object({
    timestamp: z.union([z.string(), z.number()]), values: z.array(z.object({ query: z.string(), extracted_value: z.number().optional(), value: z.string().optional() }).passthrough()),
  }).passthrough()).optional() }).passthrough().optional() }),
  google_patents_details: envelope.extend({ title: z.string().optional(), abstract: z.string().optional(), publication_number: z.string().optional() }),
};
export function validateResponse(engine: Engine, raw: unknown): Record<string, unknown> {
  const parsed = schemas[engine].safeParse(raw);
  if (!parsed.success) throw new AppError("SEARCH_SCHEMA", "The search service returned an unsupported response.", 502);
  const data = parsed.data;
  const empty = data.error && /hasn.t returned any results|no results|not enough (search )?volume/i.test(data.error);
  if (data.error && !empty) {
    if (/api.key|unauthorized|invalid.*key/i.test(data.error)) throw new AppError("SEARCH_AUTH", "The search API key was rejected.", 503);
    if (/credit|limit|quota/i.test(data.error)) throw new AppError("SEARCH_QUOTA", "Search credits or service rate limits were reached.", 503);
    if (/invalid|missing|parameter|unsupported/i.test(data.error)) throw new AppError("SEARCH_QUERY", "The search service rejected the query parameters.", 502);
    throw new AppError("SEARCH_TEMPORARY", "The search service could not complete this request.", 502, true);
  }
  if (!empty && data.search_metadata.status !== "Success") throw new AppError("SEARCH_STATUS", "Search results are not ready.", 502, true);
  return data;
}

import type { SearchPlanItem } from "@/src/lib/contracts";
export function shopping(query: string, locale: Record<string, string>): SearchPlanItem {
  return { engine: "google_shopping", query, purpose: "Commercial product evidence", params: { q: query, hl: "en", ...locale } };
}

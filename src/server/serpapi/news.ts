import type { SearchPlanItem } from "@/src/lib/contracts";
export function news(query: string, locale: Record<string, string>): SearchPlanItem {
  return { engine: "google_news", query, purpose: "Recent company and market activity", params: { q: query, hl: "en", ...locale } };
}

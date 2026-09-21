import type { SearchPlanItem } from "@/src/lib/contracts";
export function google(query: string, purpose: string, locale: Record<string, string> = {}): SearchPlanItem {
  return { engine: "google", query, purpose, params: { q: query, num: 10, ...locale } };
}

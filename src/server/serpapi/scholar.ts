import type { SearchPlanItem } from "@/src/lib/contracts";
export function scholar(query: string): SearchPlanItem {
  return { engine: "google_scholar", query, purpose: "Academic research landscape", params: { q: query, num: 12 } };
}

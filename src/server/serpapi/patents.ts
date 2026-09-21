import type { SearchPlanItem } from "@/src/lib/contracts";
export function patents(query: string): SearchPlanItem {
  return { engine: "google_patents", query, purpose: "Prior-art landscape", params: { q: query, num: 20, language: "ENGLISH" } };
}

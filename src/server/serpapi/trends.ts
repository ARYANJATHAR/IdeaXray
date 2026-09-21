import type { SearchPlanItem } from "@/src/lib/contracts";
export function trends(terms: string[], region: string): SearchPlanItem {
  const geo = region === "india" ? "IN" : region === "us" ? "US" : "";
  const query = terms.slice(0, 5).map((term) => term.replaceAll(",", " ")).join(",");
  return { engine: "google_trends", query, purpose: "Five-year public interest", params: { q: query, data_type: "TIMESERIES", date: "today 5-y", ...(geo ? { geo } : {}) } };
}

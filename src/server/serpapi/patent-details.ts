import type { SearchPlanItem } from "@/src/lib/contracts";
import { AppError } from "../errors";
export function patentDetails(patentId: string): SearchPlanItem {
  if (!/^patent\/[A-Za-z0-9.-]+\/[a-z]{2}$/.test(patentId)) throw new AppError("PATENT_ID", "The patent identifier is not supported.", 400);
  return { engine: "google_patents_details", query: patentId, purpose: "Enrich a highly relevant patent", params: { patent_id: patentId } };
}

import type { EvidenceItem, Finding, IdeaDecomposition } from "@/src/lib/contracts";
import { languageProvider } from "./provider";
import { findingSchema } from "./schemas";
import { evidenceInput } from "./classify";
export const unsafeClaim = /\b(patentable|legally novel|guaranteed (success|white space)|nobody has invented|no one has invented|success probability)\b/i;
export function validCitations(ids: string[], evidence: EvidenceItem[]) {
  const known = new Set(evidence.filter((item) => item.retained).map((item) => item.id));
  return ids.length > 0 && ids.every((id) => known.has(id));
}
export async function synthesize(idea: IdeaDecomposition, evidence: EvidenceItem[]): Promise<Finding[]> {
  const selected = evidence.filter((item) => item.retained).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 55);
  if (!selected.length) return [];
  const response = await languageProvider.structured("Write up to six cautious landscape findings. Every statement must be supported by the cited supplied evidence. Do not give legal novelty conclusions, company-failure conclusions, or quantitative claims. Return an empty findings array if the evidence does not support useful statements.", { idea, evidence: evidenceInput(selected) }, findingSchema);
  return response.findings.filter((finding) => validCitations(finding.evidenceIds, selected) && !unsafeClaim.test(finding.title + " " + finding.body));
}

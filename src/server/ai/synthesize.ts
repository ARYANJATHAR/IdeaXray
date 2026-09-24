import type { EvidenceItem, Finding, IdeaDecomposition } from "@/src/lib/contracts";
import { languageProvider } from "./provider";
import { findingSchema } from "./schemas";
import { evidenceInput } from "./classify";
import { groundedClaims } from "./grounding";
export const unsafeClaim = /\b(patentable|legally novel|guaranteed (success|white space)|nobody has invented|no one has invented|success probability)\b/i;
export function validCitations(ids: string[], evidence: EvidenceItem[]) {
  const known = new Set(evidence.filter((item) => item.retained).map((item) => item.id));
  return ids.length > 0 && ids.every((id) => known.has(id));
}
export async function synthesize(idea: IdeaDecomposition, evidence: EvidenceItem[], onReview: () => Promise<void> = async () => {}): Promise<Finding[]> {
  const selected = evidence.filter((item) => item.retained).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 18);
  if (!selected.length) return [];
  const response = await languageProvider.structured("Write up to six cautious landscape findings. Every statement must be supported by the cited supplied evidence. Do not give legal novelty conclusions, company-failure conclusions, or quantitative claims. Return an empty findings array if the evidence does not support useful statements.", {
    idea: { title: idea.title, problem: idea.problem, solution: idea.solution, concepts: idea.concepts },
    evidence: evidenceInput(selected),
  }, findingSchema);
  const candidates = response.findings.filter((finding) => validCitations(finding.evidenceIds, selected) && !unsafeClaim.test(finding.title + " " + finding.body));
  await onReview();
  return (await groundedClaims(candidates, selected)).map((finding) => ({ ...finding, confidence: finding.confidence === "high" ? "medium" : finding.confidence }));
}

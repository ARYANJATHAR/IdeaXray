import { randomUUID } from "node:crypto";
import type { CoverageRow, EvidenceItem, Gap, IdeaDecomposition, TrendPoint } from "@/src/lib/contracts";
import { languageProvider } from "./provider";
import { gapSchema } from "./schemas";
import { evidenceInput } from "./classify";
import { unsafeClaim, validCitations } from "./synthesize";
import { trendMomentum } from "../scoring/landscape";
export async function analyzeGaps(idea: IdeaDecomposition, coverage: CoverageRow[], evidence: EvidenceItem[], trends: TrendPoint[]): Promise<Gap[]> {
  const highest = Math.max(0, ...coverage.map((row) => row.total));
  const momentum = trendMomentum(trends);
  const candidates = coverage.filter((row) => row.level === "low" && row.total < highest && row.research > 0);
  if (!candidates.length || momentum === null || momentum < -20) return [];
  const selected = evidence.filter((item) => item.retained);
  const provided = [...selected].sort((a, b) => Number(candidates.some((row) => b.concepts.includes(row.concept))) - Number(candidates.some((row) => a.concepts.includes(row.concept))) || b.relevanceScore - a.relevanceScore).slice(0, 18);
  const response = await languageProvider.structured("Identify at most five potential areas to investigate from the candidate concepts. Each needs lower comparative coverage, research feasibility evidence, and a relationship to the user idea. Cite both feasibility and higher-coverage comparative sources. Do not imply no competitors or legal novelty. Return no gaps if unsupported.", {
    idea: { title: idea.title, problem: idea.problem, concepts: idea.concepts },
    candidates: candidates.map((row) => ({ concept: row.concept, total: row.total, research: row.research })),
    momentum,
    evidence: evidenceInput(provided),
  }, gapSchema);
  return response.gaps.flatMap((gap) => {
    const candidate = candidates.find((row) => row.concept === gap.concept);
    if (!candidate || !validCitations(gap.evidenceIds, provided) || unsafeClaim.test(gap.title + gap.body + gap.rationale)) return [];
    if (!selected.some((item) => item.type === "RESEARCH" && gap.evidenceIds.includes(item.id) && item.concepts.includes(gap.concept))) return [];
    if (!coverage.some((row) => row.total > candidate.total && row.evidenceIds.some((id) => gap.evidenceIds.includes(id)))) return [];
    return [{ ...gap, id: randomUUID(), confidence: gap.confidence === "high" ? "medium" as const : gap.confidence,
      body: gap.concept + " appears less represented among the sources analysed. " + gap.body,
      rationale: gap.rationale,
    }];
  });
}

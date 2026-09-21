import type { EvidenceItem, IdeaDecomposition } from "@/src/lib/contracts";
import { deduplicate } from "../normalization/deduplicate";
import { getServerEnv } from "../env";

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "your", "using", "into", "about", "have", "been", "will", "their", "which", "when", "where", "what", "how", "are", "was", "can", "may", "use", "used", "also", "more", "such", "than", "other", "some", "any", "all", "not", "but", "its", "our", "you", "who", "via", "per", "new", "one", "two"]);

function tokens(text: string) {
  return [...new Set((text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !STOP.has(word)))];
}

function lexicalScore(queryTokens: Set<string>, text: string) {
  const haystack = tokens(text);
  if (!haystack.length || !queryTokens.size) return 0;
  let hits = 0;
  for (const token of haystack) if (queryTokens.has(token)) hits++;
  if (!hits) return 0;
  const matchRatio = hits / Math.min(queryTokens.size, 12);
  const density = hits / haystack.length;
  return Math.round(Math.max(0, Math.min(1, Math.min(1, matchRatio) * 0.65 + density * 0.35)) * 100);
}

function retainTopPerSearch(evidence: EvidenceItem[], minimumScore: number, count: number) {
  const byRun = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const group = byRun.get(item.searchRunId) ?? [];
    group.push(item);
    byRun.set(item.searchRunId, group);
  }
  for (const items of byRun.values()) {
    const sorted = [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
    for (const item of sorted.slice(0, count)) {
      if (item.relevanceScore >= minimumScore) item.retained = true;
    }
  }
}

export function rankEvidence(idea: IdeaDecomposition, evidence: EvidenceItem[]) {
  const ideaTokens = new Set(tokens([idea.title, idea.problem, idea.solution, ...idea.concepts, ...idea.technologies, ...idea.synonyms].join(" ")));
  const threshold = getServerEnv().RELEVANCE_THRESHOLD;

  for (const item of evidence) {
    const text = [item.title, item.snippet ?? "", ...item.concepts].join(" ");
    const ideaScore = lexicalScore(ideaTokens, text);
    const queryScore = lexicalScore(new Set(tokens(item.query)), text);
    item.relevanceScore = Math.max(ideaScore, queryScore);
    item.retained = item.type === "TREND" || item.relevanceScore >= threshold;
  }

  retainTopPerSearch(evidence, 5, 5);
  deduplicate(evidence);
  return evidence;
}

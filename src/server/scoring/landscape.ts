import type { CoverageRow, EvidenceItem, EvidenceType, Indicator, TrendPoint } from "@/src/lib/contracts";
export function coverageMatrix(concepts: string[], evidence: EvidenceItem[]): CoverageRow[] {
  return concepts.map((concept) => {
    const items = evidence.filter((item) => item.retained && item.concepts.includes(concept) && item.type !== "TREND");
    const count = (types: EvidenceType[]) => items.filter((item) => types.includes(item.type)).length;
    return { concept, patents: count(["PATENT"]), research: count(["RESEARCH"]), products: count(["PRODUCT"]), web: count(["COMPANY", "WEB", "NEWS"]), total: items.length, level: items.length >= 10 ? "high" : items.length >= 4 ? "medium" : "low", evidenceIds: items.map((item) => item.id) };
  });
}
export function trendMomentum(points: TrendPoint[]): number | null {
  const terms = [...new Set(points.map((point) => point.term))];
  const changes = terms.flatMap((term) => {
    const data = points.filter((point) => point.term === term).sort((a, b) => a.date.localeCompare(b.date));
    if (data.length < 8 || !data.some((point) => point.value > 0)) return [];
    const window = Math.max(2, Math.floor(data.length / 4));
    const average = (values: TrendPoint[]) => values.reduce((sum, point) => sum + point.value, 0) / values.length;
    const before = average(data.slice(-window * 2, -window)); const after = average(data.slice(-window));
    if (!before) return [];
    return [Math.max(-100, Math.min(100, (after - before) / before * 100))];
  });
  return changes.length ? Math.round(changes.reduce((a, b) => a + b, 0) / changes.length) : null;
}
export function landscape(evidence: EvidenceItem[], trends: TrendPoint[]): { overview: Record<EvidenceType, number>; indicators: Indicator[] } {
  const retained = evidence.filter((item) => item.retained);
  const types: EvidenceType[] = ["PATENT", "RESEARCH", "PRODUCT", "COMPANY", "NEWS", "WEB", "TREND"];
  const overview = Object.fromEntries(types.map((type) => [type, retained.filter((item) => item.type === type).length])) as Record<EvidenceType, number>;
  const activity = (items: EvidenceItem[], citationWeight = false) => {
    if (!items.length) return 0;
    const weighted = items.reduce((sum, item) => {
      const age = item.sourceDate ? Math.max(0, (Date.now() - new Date(item.sourceDate).getTime()) / 31557600000) : 10;
      const recency = 0.5 + 0.5 * Math.exp(-age / 7);
      const citations = citationWeight && typeof item.metadata.citedBy === "number" ? Math.min(0.3, Math.log1p(item.metadata.citedBy) / 30) : 0;
      return sum + item.relevanceScore / 100 * (recency + citations);
    }, 0);
    return Math.round(Math.min(100, Math.log1p(weighted) / Math.log(31) * 100));
  };
  const patents = retained.filter((item) => item.type === "PATENT");
  const papers = retained.filter((item) => item.type === "RESEARCH");
  const commerce = retained.filter((item) => ["PRODUCT", "COMPANY"].includes(item.type) || (item.type === "NEWS" && item.metadata.commercialEntity === true));
  const assignees = new Map<string, number>();
  for (const item of patents) if (typeof item.metadata.assignee === "string") assignees.set(item.metadata.assignee, (assignees.get(item.metadata.assignee) ?? 0) + 1);
  const concentration = patents.length ? Math.max(0, ...assignees.values()) / patents.length : 0;
  const patentScore = Math.min(100, Math.round(activity(patents) * (1 + concentration * 0.1)));
  const researchScore = activity(papers, true); const commercialScore = activity(commerce);
  const momentum = trendMomentum(trends);
  const make = (name: string, value: number | null, explanation: string, items: EvidenceItem[]): Indicator => ({ name, value, explanation, evidenceIds: items.map((item) => item.id) });
  return { overview, indicators: [
    make("Patent Activity", patentScore, "Log-scaled retained patent evidence, similarity, recency, and assignee concentration.", patents),
    make("Research Activity", researchScore, "Log-scaled retained papers, similarity, recency, and available citation counts.", papers),
    make("Commercial Activity", commercialScore, "Products, companies, and commercial news weighted by similarity and recency.", commerce),
    make("Public Interest Momentum", momentum, "Percentage change between the last two equal time windows in available Google Trends series; not search volume.", retained.filter((item) => item.type === "TREND")),
    make("Landscape Crowding", Math.round(patentScore * 0.3 + researchScore * 0.2 + commercialScore * 0.5), "Weighted research heuristic: 30% patent activity, 20% research activity, 50% commercial activity.", retained.filter((item) => item.type !== "TREND")),
  ] };
}

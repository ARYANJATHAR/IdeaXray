// Synthetic fixtures are used exclusively by tests, never by the application.
import { randomUUID } from "node:crypto";
import type { AnalysisSnapshot, EvidenceItem, IdeaDecomposition, Report, SearchTrace } from "@/src/lib/contracts";
export const idea: IdeaDecomposition = { title: "Camera backpack", problem: "Carry a backpack", solution: "A camera backpack follows people", concepts: ["camera", "backpack"], technologies: ["camera"], targetUsers: ["Walkers"], synonyms: [], commercialTerms: ["camera backpack"], researchTerms: ["camera backpack"], mechanisms: ["tracking"] };
export function evidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return { id: randomUUID(), searchRunId: randomUUID(), type: "WEB", title: "Camera backpack follows people", snippet: "TrailPack is a camera backpack that follows people.", url: "https://example.com/source", source: "Example", engine: "google", query: "camera backpack", relevanceScore: 80, confidenceScore: null, retained: true, concepts: ["camera"], metadata: {}, ...overrides };
}
export function searches(): SearchTrace[] {
  return (["google_patents", "google_scholar", "google", "google_news", "google_trends"] as const).map((engine) => ({ id: randomUUID(), engine, query: "camera backpack", purpose: "Test", status: "COMPLETED", resultCount: 1, retainedCount: 1, durationMs: 20, attempts: 1 }));
}
export function report(items: EvidenceItem[] = [evidence()]): Report {
  return { decomposition: idea, overview: { PATENT: 0, RESEARCH: 0, PRODUCT: 0, COMPANY: 0, NEWS: 0, WEB: items.length, TREND: 0 }, indicators: [], entities: [], timeline: [], coverage: [], gaps: [], trends: [], findings: [], evidence: items, trace: searches(), warnings: [], generatedAt: "2026-09-21T00:00:00.000Z", methodology: "Regression fixture" };
}
export function snapshot(value: Report): AnalysisSnapshot {
  return { id: randomUUID(), originalIdea: "A camera backpack that follows people", normalizedTitle: idea.title, region: "worldwide", status: "COMPLETED", progress: 100, currentStage: "COMPLETED", message: "Done", completedStages: [], warnings: [], error: null, createdAt: value.generatedAt, completedAt: value.generatedAt, report: value };
}

export const stages = [
  "QUEUED", "DECOMPOSING", "PLANNING", "SEARCHING_PATENTS", "SEARCHING_RESEARCH", "SEARCHING_MARKET",
  "SEARCHING_NEWS", "SEARCHING_TRENDS", "BUILDING_REPORT", "COMPLETED", "PARTIAL", "FAILED",
] as const;
export type Stage = typeof stages[number];
export type AnalysisStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
export const terminalStatuses: AnalysisStatus[] = ["COMPLETED", "PARTIAL", "FAILED"];
export type EvidenceType = "PATENT" | "RESEARCH" | "PRODUCT" | "COMPANY" | "NEWS" | "WEB" | "TREND";
export const engines = ["google", "google_patents", "google_patents_details", "google_scholar", "google_news", "google_shopping", "google_trends"] as const;
export type Engine = typeof engines[number];
export type Confidence = "low" | "medium" | "high";
export interface IdeaDecomposition {
  title: string; problem: string; solution: string; targetUsers: string[]; technologies: string[];
  mechanisms: string[]; synonyms: string[]; commercialTerms: string[]; researchTerms: string[]; concepts: string[];
}
export interface EvidenceItem {
  id: string; searchRunId: string; type: EvidenceType; title: string; snippet?: string; url?: string;
  source?: string; sourceDate?: string; engine: Engine; query: string; serpApiSearchId?: string;
  relevanceScore: number; confidenceScore: number; retained: boolean; duplicateOf?: string;
  concepts: string[]; metadata: Record<string, unknown>;
}
export interface SearchPlanItem { engine: Engine; query: string; purpose: string; params: Record<string, string | number> }
export interface SearchTrace {
  id: string; engine: Engine; query: string; purpose: string; status: "COMPLETED" | "FAILED" | "CACHED" | "SKIPPED";
  resultCount: number; retainedCount: number; durationMs: number; serpApiSearchId?: string; officialUrl?: string; error?: string; attempts: number;
}
export interface Entity { id: string; name: string; type: "PRODUCT" | "COMPANY"; summary: string; evidenceIds: string[]; similarity: number }
export interface TimelineItem { id: string; date: string; precision: "day" | "year"; title: string; type: EvidenceType; evidenceIds: string[] }
export interface CoverageRow { concept: string; patents: number; research: number; products: number; web: number; total: number; level: "low" | "medium" | "high"; evidenceIds: string[] }
export interface Gap { id: string; title: string; body: string; rationale: string; confidence: Confidence; evidenceIds: string[]; concept: string }
export interface TrendPoint { date: string; term: string; value: number }
export interface Indicator { name: string; value: number | null; explanation: string; evidenceIds: string[] }
export interface Finding { title: string; body: string; evidenceIds: string[]; confidence: Confidence }
export interface Report {
  decomposition: IdeaDecomposition; overview: Record<EvidenceType, number>; indicators: Indicator[];
  entities: Entity[]; timeline: TimelineItem[]; coverage: CoverageRow[];
  gaps: Gap[]; trends: TrendPoint[]; findings: Finding[]; evidence: EvidenceItem[]; trace: SearchTrace[];
  warnings: string[]; generatedAt: string; methodology: string;
}
export interface AnalysisSnapshot {
  id: string; originalIdea: string; normalizedTitle: string | null; region: string;
  status: AnalysisStatus; progress: number; currentStage: Stage; message: string;
  completedStages: Stage[];
  warnings: string[]; error: string | null; createdAt: string; completedAt: string | null;
  report: Report | null;
}
export const stageLabels: Record<Stage, string> = {
  QUEUED: "Preparing your research", DECOMPOSING: "Understanding your idea", PLANNING: "Creating a research strategy",
  SEARCHING_PATENTS: "Searching related patents", SEARCHING_RESEARCH: "Searching academic research",
  SEARCHING_MARKET: "Searching products and companies", SEARCHING_NEWS: "Searching news and market activity",
  SEARCHING_TRENDS: "Analysing public interest", BUILDING_REPORT: "Building your evidence-backed report",
  COMPLETED: "Research complete", PARTIAL: "Report ready with some limitations", FAILED: "Research could not finish",
};

import "server-only";
import { Prisma } from "@prisma/client";
import { analysisInputSchema } from "@/src/lib/analysis-input";
import type { EvidenceItem, Report, SearchPlanItem, SearchTrace, Stage, TrendPoint } from "@/src/lib/contracts";
import { db, json } from "../db/client";
import { requireResearchConfig, getServerEnv } from "../env";
import { AppError, logEvent, publicError } from "../errors";
import { assertJobActive, failAnalysis, withTimeBudget } from "./lifecycle";
import { checkCredits, runSearch } from "../serpapi/client";
import { normalize, trendPoints, list, text } from "../serpapi/normalize";
import { researchBrief } from "./brief";
import { synthesize } from "../ai/synthesize";
import { analyzeGaps } from "../ai/gap-analysis";
import { planQueries } from "./planner";
import { rankEvidence } from "./rank";
import { deduplicate } from "../normalization/deduplicate";
import { buildTimeline } from "./timeline";
import { coverageMatrix, landscape } from "../scoring/landscape";
import { completeStage, persistEvidence, persistReport, progress } from "./persistence";

const searchStages: Record<string, Stage> = {
  google_patents: "SEARCHING_PATENTS",
  google_scholar: "SEARCHING_RESEARCH",
  google: "SEARCHING_MARKET",
  google_shopping: "SEARCHING_MARKET",
  google_news: "SEARCHING_NEWS",
  google_trends: "SEARCHING_TRENDS",
};

export async function runAnalysis(analysisId: string) {
  const warnings: string[] = [];
  const evidence: EvidenceItem[] = [];
  const trace: SearchTrace[] = [];
  const relatedSearches: NonNullable<Report["relatedSearches"]> = [];
  let trends: TrendPoint[] = [];
  const warn = (message: string) => { if (!warnings.includes(message)) warnings.push(message); };
  try {
    assertJobActive();
    const analysis = await db().analysis.findUniqueOrThrow({ where: { id: analysisId } });
    if (analysis.status !== "RUNNING") return;
    await db().$transaction([
    db().insight.deleteMany({ where: { analysisId } }),
    db().timelineEvent.deleteMany({ where: { analysisId } }),
    db().entity.deleteMany({ where: { analysisId } }),
    db().trendPoint.deleteMany({ where: { analysisId } }),
    db().evidenceItem.deleteMany({ where: { analysisId } }),
    db().searchRun.deleteMany({ where: { analysisId } }),
    db().searchQuery.deleteMany({ where: { analysisId } }),
    db().analysis.update({
      where: { id: analysisId, status: "RUNNING", leaseExpiresAt: { gt: new Date() } },
      data: { summaryJson: Prisma.DbNull, warningsJson: json([]), completedStagesJson: json([]), error: null, progress: 0, searchAttempts: 0, status: "RUNNING" },
    }),
  ]);

    requireResearchConfig();
    await checkCredits();
    const input = analysisInputSchema.parse({ idea: analysis.originalIdea, region: analysis.region });
    await progress(analysisId, "QUEUED");
    await completeStage(analysisId, "QUEUED");
    await progress(analysisId, "DECOMPOSING");
    const idea = researchBrief(input.idea);
    await completeStage(analysisId, "DECOMPOSING");
    await db().analysis.update({ where: { id: analysisId }, data: { normalizedTitle: idea.title } });
    await progress(analysisId, "PLANNING");
    const plan = await planQueries(idea, input);
    await completeStage(analysisId, "PLANNING");

    async function search(item: SearchPlanItem) {
      assertJobActive();
      await db().searchQuery.create({ data: { analysisId, engine: item.engine, query: item.query, purpose: item.purpose, paramsJson: json(item.params) } });
      const result = await runSearch(analysisId, item);
      trace.push(result.trace);
      if (!result.raw || ["FAILED", "SKIPPED"].includes(result.trace.status)) {
        warn(item.engine + ": " + result.trace.error);
        return [];
      }
      if (item.engine === "google") {
        for (const related of list(result.raw.related_searches).slice(0, 8)) {
          const query = text(related.query);
          if (query && !relatedSearches.some((entry) => entry.query === query)) relatedSearches.push({ query: query.slice(0, 200), searchRunId: result.trace.id });
        }
      }
      const normalized = normalize(result.raw, item, result.trace);
      result.trace.resultCount = normalized.length;
      await db().searchRun.update({ where: { id: result.trace.id }, data: { resultCount: normalized.length } });
      if (item.engine === "google_trends") trends = trendPoints(result.raw);
      evidence.push(...normalized);
      await persistEvidence(analysisId, normalized);
      return normalized;
    }

    let lastStage: Stage | undefined;
    for (const item of plan) {
      const stage = searchStages[item.engine];
      if (stage !== lastStage) {
        if (lastStage) await completeStage(analysisId, lastStage);
        await progress(analysisId, stage);
        lastStage = stage;
      }
      await search(item);
    }
    if (lastStage) await completeStage(analysisId, lastStage);

    await progress(analysisId, "CLASSIFYING_EVIDENCE");
    deduplicate(evidence);
    rankEvidence(idea, evidence);
    const classificationComplete = false;
    const settings = getServerEnv();
    const enrich = settings.AI_ENRICHMENT === "true" && Boolean(settings.GROQ_API_KEY || settings.OPENROUTER_API_KEY);
    for (const item of evidence) {
      if (!item.retained || item.concepts.length) continue;
      const text = [item.title, item.snippet ?? ""].join(" ").toLowerCase();
      item.concepts = idea.concepts.filter((concept) => (concept.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).some((word) => text.includes(word)));
    }
    await completeStage(analysisId, "CLASSIFYING_EVIDENCE");
    const retainedIds = new Set(evidence.filter((item) => item.retained).map((item) => item.id));
    trends = evidence.filter((item) => item.retained && item.type === "TREND").flatMap((item) => Array.isArray(item.metadata.points) ? item.metadata.points as TrendPoint[] : []);
    const timeline = buildTimeline(evidence);
    assertJobActive();
    const metrics = landscape(evidence, trends, trace, classificationComplete);
    const coverage = coverageMatrix(idea.concepts, evidence);
    await progress(analysisId, "ANALYZING_OPPORTUNITIES");
    let gaps: Report["gaps"] = [];
    try { if (enrich) gaps = await withTimeBudget(30000, () => analyzeGaps(idea, coverage, evidence, trends)); } catch (error) { warn("Opportunity analysis incomplete: " + publicError(error)); }
    await completeStage(analysisId, "ANALYZING_OPPORTUNITIES");
    await progress(analysisId, "SUMMARIZING");
    let reviewing = false;
    const review = async () => {
      if (reviewing) return;
      await completeStage(analysisId, "SUMMARIZING");
      await progress(analysisId, "CHECKING_FINDINGS");
      reviewing = true;
    };
    let findings: Report["findings"] = [];
    try { if (enrich) findings = await withTimeBudget(45000, () => synthesize(idea, evidence, review)); } catch (error) { warn("Report synthesis incomplete: " + publicError(error)); }
    await review();
    await completeStage(analysisId, "CHECKING_FINDINGS");
    await progress(analysisId, "BUILDING_REPORT");
    for (const run of trace) {
      run.retainedCount = evidence.filter((item) => item.searchRunId === run.id && item.retained).length;
      await db().searchRun.update({ where: { id: run.id }, data: { retainedCount: run.retainedCount } });
    }
    if (!trace.some((run) => ["COMPLETED", "CACHED"].includes(run.status))) {
      throw new AppError("NO_SEARCHES", "Every search source was unavailable. Review SerpApi/AI configuration and try again.", 503);
    }
    if (!retainedIds.size) warn("No evidence met the relevance threshold. This is not proof that the idea is novel or unrepresented.");
    await completeStage(analysisId, "BUILDING_REPORT");
    await persistEvidence(analysisId, evidence);
    await persistReport(analysisId, {
      decomposition: idea,
      classificationComplete,
      sourceFirst: true,
      aiEnrichment: enrich,
      relatedSearches,
      ...metrics,
      entities: [],
      timeline,
      coverage,
      gaps,
      trends,
      findings,
      evidence,
      trace,
      warnings,
      generatedAt: new Date().toISOString(),
      methodology: "Search vocabulary is extracted from the submitted brief without AI. Shopping is selected using physical-product keywords; this routing is heuristic. Product and web cards reproduce source titles and excerpts without confirming competitor status. Company extraction is not performed; commercial and crowding scores remain unavailable. Source activity metrics use only deduplicated evidence meeting the configured lexical relevance threshold. Google Trends is retained separately for interest calculations. Indicators are internal research heuristics, not measured probabilities or legal assessments. AI interpretations are checked against supplied excerpts, but still require human review. Searches and retries share a configurable budget; cached responses are identified in the trace.",
    });
    logEvent("analysis_finished", { analysisId });
  } catch (error) {
    // Mark failure first. A failed evidence write must not leave an active job behind.
    await failAnalysis(analysisId, error);
  }
}

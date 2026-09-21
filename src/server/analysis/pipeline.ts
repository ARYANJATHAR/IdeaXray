import "server-only";
import { Prisma } from "@prisma/client";
import { analysisInputSchema } from "@/src/lib/analysis-input";
import type { Entity, EvidenceItem, Report, SearchPlanItem, SearchTrace, Stage, TrendPoint } from "@/src/lib/contracts";
import { db, json } from "../db/client";
import { requireResearchConfig } from "../env";
import { AppError, logEvent, publicError } from "../errors";
import { checkCredits, runSearch } from "../serpapi/client";
import { normalize, trendPoints } from "../serpapi/normalize";
import { decompose } from "../ai/decompose";
import { classify } from "../ai/classify";
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
  google_news: "SEARCHING_NEWS",
  google_trends: "SEARCHING_TRENDS",
};

export async function runAnalysis(analysisId: string) {
  const analysis = await db().analysis.findUniqueOrThrow({ where: { id: analysisId } });
  if (!["QUEUED", "RUNNING"].includes(analysis.status)) return;

  await db().$transaction([
    db().insight.deleteMany({ where: { analysisId } }),
    db().timelineEvent.deleteMany({ where: { analysisId } }),
    db().entity.deleteMany({ where: { analysisId } }),
    db().trendPoint.deleteMany({ where: { analysisId } }),
    db().evidenceItem.deleteMany({ where: { analysisId } }),
    db().searchRun.deleteMany({ where: { analysisId } }),
    db().searchQuery.deleteMany({ where: { analysisId } }),
    db().analysis.update({
      where: { id: analysisId },
      data: { summaryJson: Prisma.DbNull, warningsJson: json([]), completedStagesJson: json([]), error: null, progress: 0, searchAttempts: 0, status: "RUNNING" },
    }),
  ]);

  const warnings: string[] = [];
  const evidence: EvidenceItem[] = [];
  const trace: SearchTrace[] = [];
  let trends: TrendPoint[] = [];
  const warn = (message: string) => { if (!warnings.includes(message)) warnings.push(message); };

  try {
    requireResearchConfig();
    await checkCredits();
    const input = analysisInputSchema.parse({ idea: analysis.originalIdea, region: analysis.region });
    await progress(analysisId, "QUEUED");
    await completeStage(analysisId, "QUEUED");
    await progress(analysisId, "DECOMPOSING");
    const idea = await decompose(input.idea);
    await completeStage(analysisId, "DECOMPOSING");
    await db().analysis.update({ where: { id: analysisId }, data: { normalizedTitle: idea.title } });
    await progress(analysisId, "PLANNING");
    const plan = await planQueries(idea, input);
    await completeStage(analysisId, "PLANNING");

    async function search(item: SearchPlanItem) {
      await db().searchQuery.create({ data: { analysisId, engine: item.engine, query: item.query, purpose: item.purpose, paramsJson: json(item.params) } });
      const result = await runSearch(analysisId, item);
      trace.push(result.trace);
      if (!result.raw || ["FAILED", "SKIPPED"].includes(result.trace.status)) {
        warn(item.engine + ": " + result.trace.error);
        return [];
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

    await progress(analysisId, "BUILDING_REPORT");
    deduplicate(evidence);
    rankEvidence(idea, evidence);
    let entities: Entity[] = [];
    try { entities = await classify(idea, evidence); } catch (error) { warn("Concept and entity extraction incomplete: " + publicError(error)); }
    for (const item of evidence) {
      if (!item.retained || item.concepts.length) continue;
      const text = [item.title, item.snippet ?? ""].join(" ").toLowerCase();
      item.concepts = idea.concepts.filter((concept) => (concept.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).some((word) => text.includes(word)));
    }
    const retainedIds = new Set(evidence.filter((item) => item.retained).map((item) => item.id));
    entities = entities.map((entity) => ({
      ...entity,
      evidenceIds: entity.evidenceIds.filter((id) => retainedIds.has(id)),
    })).filter((entity) => entity.evidenceIds.length);
    trends = evidence.filter((item) => item.retained && item.type === "TREND").flatMap((item) => Array.isArray(item.metadata.points) ? item.metadata.points as TrendPoint[] : []);
    const timeline = buildTimeline(evidence);
    const metrics = landscape(evidence, trends);
    for (const indicator of metrics.indicators) {
      const relevantEngines = indicator.name === "Patent Activity" ? ["google_patents"]
        : indicator.name === "Research Activity" ? ["google_scholar"]
        : indicator.name === "Commercial Activity" ? ["google", "google_news"]
        : [];
      if (!indicator.evidenceIds.length && relevantEngines.length && !trace.some((run) => relevantEngines.includes(run.engine) && ["COMPLETED", "CACHED"].includes(run.status))) {
        indicator.value = null;
      }
    }
    const coverage = coverageMatrix(idea.concepts, evidence);
    let gaps: Report["gaps"] = [];
    try { gaps = await analyzeGaps(idea, coverage, evidence, trends); } catch (error) { warn("Opportunity analysis incomplete: " + publicError(error)); }
    let findings: Report["findings"] = [];
    try { findings = await synthesize(idea, evidence); } catch (error) { warn("Report synthesis incomplete: " + publicError(error)); }
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
      ...metrics,
      entities,
      timeline,
      coverage,
      gaps,
      trends,
      findings,
      evidence,
      trace,
      warnings,
      generatedAt: new Date().toISOString(),
      methodology: "Metrics use only deduplicated evidence above the configured lexical relevance threshold. Indicators are internal research heuristics, not legal, investment, or patentability assessments. Each analysis uses up to six live SerpApi searches.",
    });
    logEvent("analysis_finished", { analysisId });
  } catch (error) {
    await persistEvidence(analysisId, evidence);
    await db().analysis.update({
      where: { id: analysisId },
      data: {
        status: "FAILED",
        currentStage: "FAILED",
        message: "Research could not finish",
        error: publicError(error),
        warningsJson: json(warnings),
        completedAt: new Date(),
      },
    });
    logEvent("analysis_failed", { analysisId, code: error instanceof AppError ? error.code : "INTERNAL" });
  }
}

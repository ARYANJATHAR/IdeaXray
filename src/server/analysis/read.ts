import "server-only";
import type { AnalysisSnapshot, Report, Stage } from "@/src/lib/contracts";
import { stages } from "@/src/lib/contracts";
import { db } from "../db/client";
import { AppError } from "../errors";
import { analysisId, ownerHash } from "../http/security";

export async function readAnalysis(id: string, includeReport = true): Promise<AnalysisSnapshot> {
  const owner = await ownerHash();
  const analysis = await db().analysis.findFirst({
    where: { id: analysisId(id), ownerHash: owner },
    select: {
      id: true, originalIdea: true, normalizedTitle: true, region: true, status: true,
      progress: true, currentStage: true, completedStagesJson: true, message: true, warningsJson: true,
      error: true, createdAt: true, completedAt: true, summaryJson: includeReport,
    },
  });
  if (!analysis) throw new AppError("NOT_FOUND", "This analysis was not found in your browser session.", 404);
  return {
    id: analysis.id,
    originalIdea: analysis.originalIdea,
    normalizedTitle: analysis.normalizedTitle,
    region: analysis.region,
    status: analysis.status,
    progress: analysis.progress,
    currentStage: analysis.currentStage as Stage,
    message: analysis.message,
    completedStages: Array.isArray(analysis.completedStagesJson) ? analysis.completedStagesJson.filter((item): item is Stage => typeof item === "string" && stages.includes(item as Stage)) : [],
    warnings: Array.isArray(analysis.warningsJson) ? analysis.warningsJson.filter((item): item is string => typeof item === "string") : [],
    error: analysis.error,
    createdAt: analysis.createdAt.toISOString(),
    completedAt: analysis.completedAt?.toISOString() ?? null,
    report: includeReport && analysis.summaryJson ? analysis.summaryJson as unknown as Report : null,
  };
}

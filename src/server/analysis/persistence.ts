import type { EvidenceItem, Report, Stage } from "@/src/lib/contracts";
import { stageLabels } from "@/src/lib/contracts";
import { db, json } from "../db/client";
import { entityKey } from "../normalization/deduplicate";

export async function progress(id: string, stage: Stage, percent: number) {
  await db().analysis.updateMany({
    where: { id, status: { in: ["QUEUED", "RUNNING"] }, progress: { lte: percent } },
    data: { status: "RUNNING", currentStage: stage, progress: percent, message: stageLabels[stage] },
  });
}

export async function completeStage(id: string, stage: Stage) {
  const current = await db().analysis.findUniqueOrThrow({ where: { id }, select: { completedStagesJson: true } });
  const completed = Array.isArray(current.completedStagesJson) ? current.completedStagesJson : [];
  if (!completed.includes(stage)) {
    await db().analysis.update({ where: { id }, data: { completedStagesJson: json([...completed, stage]) } });
  }
}

export async function persistEvidence(analysisId: string, evidence: EvidenceItem[]) {
  for (let offset = 0; offset < evidence.length; offset += 40) {
    await db().$transaction(evidence.slice(offset, offset + 40).map((item) => {
      const data = {
        analysisId, searchRunId: item.searchRunId, type: item.type, title: item.title, snippet: item.snippet ?? null,
        url: item.url ?? null, source: item.source ?? null, sourceDate: item.sourceDate ? new Date(item.sourceDate) : null,
        relevanceScore: item.relevanceScore, confidenceScore: item.confidenceScore, retained: item.retained,
        duplicateOf: item.duplicateOf ?? null, conceptsJson: json(item.concepts), metadataJson: json(item.metadata),
      };
      return db().evidenceItem.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
    }));
  }
}

export async function persistReport(analysisId: string, report: Report) {
  await db().$transaction(async (tx) => {
    if (report.entities.length) {
      await tx.entity.createMany({
        data: report.entities.map((entity) => ({
          id: entity.id, analysisId, name: entity.name, normalizedName: entityKey(entity.name), type: entity.type,
          summary: entity.summary, evidenceIdsJson: json(entity.evidenceIds), metadataJson: json({ similarity: entity.similarity }),
        })),
        skipDuplicates: true,
      });
    }
    if (report.timeline.length) {
      await tx.timelineEvent.createMany({
        data: report.timeline.map((event) => ({
          id: event.id, analysisId, date: new Date(event.date), precision: event.precision, title: event.title, type: event.type, evidenceIdsJson: json(event.evidenceIds),
        })),
      });
    }
    if (report.trends.length) {
      await tx.trendPoint.createMany({
        data: report.trends.map((point) => ({ analysisId, date: new Date(point.date), term: point.term, value: point.value })),
        skipDuplicates: true,
      });
    }
    const insights = [
      ...report.gaps.map((gap) => ({ type: "OPPORTUNITY", title: gap.title, body: gap.body, confidence: gap.confidence, detail: gap, ids: gap.evidenceIds })),
      ...report.findings.map((finding) => ({ type: "LANDSCAPE", title: finding.title, body: finding.body, confidence: finding.confidence, detail: finding, ids: finding.evidenceIds })),
    ];
    for (const insight of insights) {
      await tx.insight.create({
        data: {
          analysisId, type: insight.type, title: insight.title, body: insight.body, confidence: insight.confidence,
          detailJson: json(insight.detail), evidence: { create: [...new Set(insight.ids)].map((evidenceId) => ({ evidenceId })) },
        },
      });
    }
    const status = report.warnings.length ? "PARTIAL" : "COMPLETED";
    await tx.analysis.update({
      where: { id: analysisId },
      data: {
        status, progress: 100, currentStage: status, message: stageLabels[status], completedAt: new Date(),
        warningsJson: json(report.warnings), summaryJson: json(report), error: null,
      },
    });
  }, { timeout: 30000 });
}

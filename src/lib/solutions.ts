import type { Report } from "./contracts";

export function solutionsState(report: Report) {
  // Older saved reports communicate this condition through their warning text.
  const incomplete = !report.sourceFirst && (report.classificationComplete === false || report.warnings.some((warning) => warning.startsWith("Concept and entity extraction incomplete:")));
  const identified = new Set(report.entities.flatMap((entity) => entity.evidenceIds));
  const candidates = (incomplete || report.sourceFirst) ? report.evidence.filter((item) => item.retained && !item.duplicateOf && ["WEB", "PRODUCT", "COMPANY"].includes(item.type) && !identified.has(item.id))
    .sort((a, b) => b.relevanceScore - a.relevanceScore) : [];
  return { incomplete, candidates };
}

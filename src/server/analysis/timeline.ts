import { randomUUID } from "node:crypto";
import type { EvidenceItem, TimelineItem } from "@/src/lib/contracts";
export function buildTimeline(evidence: EvidenceItem[]): TimelineItem[] {
  return evidence.filter((item) => item.retained && item.sourceDate && item.type !== "TREND").map((item) => ({
    id: randomUUID(), date: item.sourceDate!, precision: item.metadata.datePrecision === "year" ? "year" as const : "day" as const,
    title: item.type === "PATENT" ? "Patent priority/filing: " + item.title : item.title, type: item.type, evidenceIds: [item.id],
  })).sort((a, b) => a.date.localeCompare(b.date));
}

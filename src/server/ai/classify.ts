import { randomUUID } from "node:crypto";
import type { Entity, EvidenceItem, IdeaDecomposition } from "@/src/lib/contracts";
import { normalizedTitle } from "@/src/lib/urls";
import { entityKey } from "../normalization/deduplicate";
import { languageProvider } from "./provider";
import { classificationSchema } from "./schemas";
export function evidenceInput(items: EvidenceItem[]) {
  return items.map((item) => ({ id: item.id, type: item.type, title: item.title, snippet: item.snippet?.slice(0, 3000), source: item.source, sourceDate: item.sourceDate, url: item.url, concepts: item.concepts }));
}
export async function classify(idea: IdeaDecomposition, evidence: EvidenceItem[]): Promise<Entity[]> {
  const items = evidence.filter((item) => item.retained);
  const entities = new Map<string, Entity>();
  for (let start = 0; start < items.length; start += 30) {
    const batch = items.slice(start, start + 30);
    const result = await languageProvider.structured("For each evidence item identify only explicitly supported concepts from the supplied concept list. Extract a named product or company only when it appears in the title/snippet; otherwise use null entity fields. A paper or patent is not itself a product. Summarize only this item's evidence.", { concepts: idea.concepts, evidence: evidenceInput(batch) }, classificationSchema);
    for (const classified of result.items) {
      const item = batch.find((candidate) => candidate.id === classified.evidenceId); if (!item) continue;
      item.concepts = [...new Set(classified.concepts.filter((concept) => idea.concepts.includes(concept)))];
      if (!classified.entityName || !classified.entityType || !classified.entitySummary || !["PRODUCT", "WEB", "NEWS", "COMPANY"].includes(item.type)) continue;
      if (!normalizedTitle(item.title + " " + (item.snippet ?? "")).includes(normalizedTitle(classified.entityName))) continue;
      item.metadata.commercialEntity = true;
      const key = classified.entityType + ":" + entityKey(classified.entityName);
      const existing = entities.get(key);
      if (existing) { existing.evidenceIds = [...new Set([...existing.evidenceIds, item.id])]; existing.similarity = Math.max(existing.similarity, item.relevanceScore); }
      else entities.set(key, { id: randomUUID(), name: classified.entityName, type: classified.entityType, summary: classified.entitySummary, evidenceIds: [item.id], similarity: item.relevanceScore });
      if (classified.entityType === "COMPANY" && item.type === "WEB") item.type = "COMPANY";
    }
  }
  return [...entities.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 20);
}

import { randomUUID } from "node:crypto";
import type { Entity, EvidenceItem, IdeaDecomposition } from "@/src/lib/contracts";
import { normalizedTitle } from "@/src/lib/urls";
import { entityKey } from "../normalization/deduplicate";
import { languageProvider } from "./provider";
import { assertJobActive } from "../analysis/lifecycle";
import { classificationSchema } from "./schemas";
export function evidenceInput(items: EvidenceItem[]) {
  return items.map((item) => ({ id: item.id, type: item.type, title: item.title.slice(0, 220), snippet: item.snippet?.slice(0, 420), concepts: item.concepts }));
}
export async function classify(idea: IdeaDecomposition, evidence: EvidenceItem[], onBatch: (entities: Entity[]) => void = () => {}): Promise<Entity[]> {
  const items = evidence.filter((item) => item.retained).sort((a, b) => Number(["WEB", "PRODUCT", "COMPANY", "NEWS"].includes(b.type)) - Number(["WEB", "PRODUCT", "COMPANY", "NEWS"].includes(a.type)) || b.relevanceScore - a.relevanceScore).slice(0, 32);
  const entities = new Map<string, Entity>();
  for (let start = 0; start < items.length; start += 8) {
    const batch = items.slice(start, start + 8);
    const result = await languageProvider.structured("For each evidence item identify only explicitly supported concepts from the supplied concept list. Extract a named product or company only when it appears in the title/snippet; otherwise use null entity fields. A paper or patent is not itself a product. Summarize only this item's evidence.", { concepts: idea.concepts, evidence: evidenceInput(batch) }, classificationSchema);
    assertJobActive();
    for (const classified of result.items) {
      const item = batch.find((candidate) => candidate.id === classified.evidenceId); if (!item) continue;
      item.concepts = [...new Set(classified.concepts.filter((concept) => idea.concepts.includes(concept)))];
      if (!classified.entityName || !classified.entityType || !classified.entitySummary || !["PRODUCT", "WEB", "NEWS", "COMPANY"].includes(item.type)) continue;
      const entityName = normalizedTitle(classified.entityName);
      if (!entityName || !normalizedTitle(item.title + " " + (item.snippet ?? "")).includes(entityName)) continue;
      item.metadata.commercialEntity = true;
      const key = classified.entityType + ":" + entityKey(classified.entityName);
      const existing = entities.get(key);
      if (existing) { existing.evidenceIds = [...new Set([...existing.evidenceIds, item.id])]; existing.similarity = Math.max(existing.similarity, item.relevanceScore); }
      else entities.set(key, { id: randomUUID(), name: classified.entityName, type: classified.entityType, summary: item.snippet ?? item.title, evidenceIds: [item.id], similarity: item.relevanceScore });
      if (item.type === "WEB") item.type = classified.entityType;
    }
    onBatch([...entities.values()].map((entity) => ({ ...entity, evidenceIds: [...entity.evidenceIds] })));
  }
  return [...entities.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 20);
}

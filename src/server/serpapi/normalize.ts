import { randomUUID } from "node:crypto";
import type { EvidenceItem, EvidenceType, SearchPlanItem, SearchTrace, TrendPoint } from "@/src/lib/contracts";
import { safeUrl } from "@/src/lib/urls";
export function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function list(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(record) : []; }
export function text(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function people(value: unknown): unknown { return typeof value === "string" ? value : Array.isArray(value) ? value.map((person) => typeof person === "string" ? person : text(record(person).name)).filter(Boolean).join(", ") : undefined; }
export function sourceDate(value: unknown): { date?: string; precision?: "day" | "year" } {
  if (typeof value !== "string") return {};
  if (/^(18|19|20)\d{2}$/.test(value)) return Number(value) <= new Date().getUTCFullYear() ? { date: value + "-01-01T00:00:00.000Z", precision: "year" } : {};
  if (!/\b(18|19|20)\d{2}\b/.test(value) || /ago|yesterday|today/i.test(value)) return {};
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) || date > new Date() ? {} : { date: date.toISOString(), precision: "day" };
}
function flattenNews(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.flatMap((row) => [row, ...list(row.stories), ...list(row.highlight)]).filter((row) => text(row.title));
}
export function trendPoints(raw: Record<string, unknown>): TrendPoint[] {
  return list(record(raw.interest_over_time).timeline_data).flatMap((row) => {
    const timestamp = Number(row.timestamp); if (!Number.isFinite(timestamp)) return [];
    const date = new Date(timestamp * 1000); if (Number.isNaN(date.valueOf())) return [];
    return list(row.values).flatMap((point) => {
      const term = text(point.query); const value = typeof point.extracted_value === "number" ? point.extracted_value : point.value === "<1" ? NaN : Number(point.value);
      return term && Number.isFinite(value) && value >= 0 && value <= 100 ? [{ date: date.toISOString(), term, value }] : [];
    });
  });
}
export function normalize(raw: Record<string, unknown>, item: SearchPlanItem, trace: SearchTrace): EvidenceItem[] {
  let rows: Record<string, unknown>[] = [];
  let type: EvidenceType = "WEB";
  switch (item.engine) {
    case "google": {
      const graph = record(raw.knowledge_graph);
      rows = [
        ...list(raw.organic_results).map((row) => ({ ...row, resultSection: "organic" })),
        ...[...list(raw.shopping_results), ...list(raw.inline_shopping_results)].map((row) => ({ ...row, resultSection: "shopping" })),
        ...(text(graph.title) ? [{ title: graph.title, snippet: graph.description, link: graph.website ?? record(graph.source).link, source: "Google Knowledge Graph", resultSection: "knowledge_graph" }] : []),
      ];
      break;
    }
    case "google_patents": rows = list(raw.organic_results); type = "PATENT"; break;
    case "google_scholar": rows = list(raw.organic_results); type = "RESEARCH"; break;
    case "google_news": rows = flattenNews(list(raw.news_results)); type = "NEWS"; break;
    case "google_shopping": rows = [...list(raw.shopping_results), ...list(raw.inline_shopping_results), ...list(raw.categorized_shopping_results).flatMap((group) => list(group.shopping_results))]; type = "PRODUCT"; break;
    case "google_patents_details": rows = text(raw.title) ? [raw] : []; type = "PATENT"; break;
    case "google_trends": {
      const points = trendPoints(raw);
      rows = [...new Set(points.map((point) => point.term))].map((term) => ({ title: term, snippet: "Google Trends relative search interest over the last five years.", link: "https://trends.google.com/trends/explore?date=today%205-y&q=" + encodeURIComponent(term), points: points.filter((point) => point.term === term) }));
      type = "TREND"; break;
    }
  }
  return rows.flatMap((row) => {
    const resultType = item.engine === "google" && row.resultSection === "shopping" ? "PRODUCT" : type;
    const title = text(row.title); if (!title) return [];
    const publication = record(row.publication_info);
    const year = text(publication.summary)?.match(/\b(?:18|19|20)\d{2}\b/)?.[0];
    const date = sourceDate(row.priority_date ?? row.filing_date ?? row.publication_date ?? row.iso_date ?? row.date ?? year);
    const patentId = text(row.patent_id) ?? (item.engine === "google_patents_details" ? item.query : undefined);
    const url = safeUrl(row.patent_link ?? row.link ?? row.product_link) ?? (patentId ? safeUrl("https://patents.google.com/" + patentId) : undefined);
    const source = text(row.source) ?? text(record(row.source).name) ?? (type === "PATENT" ? "Google Patents" : type === "RESEARCH" ? text(publication.summary) : type === "TREND" ? "Google Trends" : url ? new URL(url).hostname : undefined);
    const metadata: Record<string, unknown> = {
      publicationNumber: row.publication_number, patentId, inventor: people(row.inventor ?? row.inventors),
      assignee: people(row.assignee ?? row.assignees), priorityDate: row.priority_date, filingDate: row.filing_date,
      grantDate: row.grant_date, countryStatus: row.country_status, abstract: row.abstract, legalEvents: row.legal_events,
      keywords: row.prior_art_keywords, classifications: row.classifications, citations: row.patent_citations,
      publicationInfo: publication.summary, authors: people(publication.authors), year: year ? Number(year) : undefined,
      citedBy: record(record(row.inline_links).cited_by).total, resultId: row.result_id,
      resultSection: row.resultSection,
      price: row.price, rating: row.rating, reviews: row.reviews, productId: row.product_id,
      datePrecision: date.precision, points: row.points,
    };
    return [{
      id: randomUUID(), searchRunId: trace.id, type: resultType, title, snippet: text(row.abstract) ?? text(row.snippet),
      url, source, sourceDate: date.date, engine: item.engine, query: item.query, serpApiSearchId: trace.serpApiSearchId,
      relevanceScore: 0, confidenceScore: null, retained: false, concepts: [], metadata,
    }];
  });
}

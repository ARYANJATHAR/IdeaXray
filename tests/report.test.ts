import { solutionsState } from "@/src/lib/solutions";
import type { Entity } from "@/src/lib/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ReportView } from "@/components/analysis/report-view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rankEvidence } from "@/src/server/analysis/rank";
import { landscape, coverageMatrix } from "@/src/server/scoring/landscape";
import { normalize } from "@/src/server/serpapi/normalize";
import { languageProvider } from "@/src/server/ai/provider";
import { classify } from "@/src/server/ai/classify";
import { groundedClaims, hasSourceQuotes } from "@/src/server/ai/grounding";
import { createReportPdf } from "@/components/analysis/export-report-pdf";
import { evidence, idea, report, searches, snapshot } from "./fixtures";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("evidence and metrics", () => {
  it("does not promote weak top-ranked results above a configured threshold", () => {
    vi.stubEnv("RELEVANCE_THRESHOLD", "90");
    const item = evidence({ title: "Camera technology travel lens research", snippet: "Camera photo equipment engineering", query: "camera backpack" });
    rankEvidence(idea, [item]);
    expect(item.relevanceScore).toBeGreaterThan(5);
    expect(item.relevanceScore).toBeLessThan(90);
    expect(item.retained).toBe(false);
  });
  it("retains qualifying results but excludes duplicate URLs", () => {
    const items = [evidence(), evidence()]; rankEvidence(idea, items);
    expect(items.filter((item) => item.retained)).toHaveLength(1);
    expect(items[1].duplicateOf).toBe(items[0].id);
  });
  it("leaves unavailable categories and crowding unscored", () => {
    const trace = searches(); trace[0].status = "FAILED";
    const metrics = landscape([], [], trace).indicators;
    expect(metrics.find((item) => item.name === "Patent Activity")?.value).toBeNull();
    expect(metrics.find((item) => item.name === "Landscape Crowding")?.value).toBeNull();
    expect(metrics.find((item) => item.name === "Research Activity")?.value).toBe(0);
  });
  it("requires both commercial search sources for the combined score", () => {
    const trace = searches(); trace[3].status = "SKIPPED";
    expect(landscape([evidence({ type: "PRODUCT" })], [], trace).indicators.find((item) => item.name === "Commercial Activity")?.value).toBeNull();
  });
  it("classifies web products into product counts and commercial activity", async () => {
    const item = evidence();
    vi.spyOn(languageProvider, "structured").mockResolvedValue({ items: [{ evidenceId: item.id, concepts: ["camera"], entityName: "TrailPack", entityType: "PRODUCT", entitySummary: "Invented promotional claim" }] });
    const entities = await classify(idea, [item]);
    expect(item.type).toBe("PRODUCT");
    expect(entities[0].summary).toBe(item.snippet);
    const metrics = landscape([item], [], searches());
    expect(metrics.overview.PRODUCT).toBe(1);
    expect(metrics.indicators.find((item) => item.name === "Commercial Activity")?.value).toBeGreaterThan(0);
    expect(coverageMatrix(idea.concepts, [item])[0].products).toBe(1);
  });
  it("rejects an invented entity name", async () => {
    const item = evidence();
    vi.spyOn(languageProvider, "structured").mockResolvedValue({ items: [{ evidenceId: item.id, concepts: [], entityName: "ImaginaryBrand", entityType: "PRODUCT", entitySummary: "Unsupported" }] });
    expect(await classify(idea, [item])).toEqual([]);
  });
  it("does not manufacture a confidence score", () => {
    const run = searches()[2];
    const items = normalize({ organic_results: [{ title: "Real response title", link: "https://example.com" }] }, { engine: "google", query: "camera", purpose: "Test", params: {} }, run);
    expect(items[0].confidenceScore).toBeNull();
  });
});

describe("grounding", () => {
  it("rejects fabricated supporting quotations even with a real source ID", () => {
    const item = evidence(); const claim = { title: "Claim", body: "Claim", evidenceIds: [item.id] };
    expect(hasSourceQuotes(claim, [{ evidenceId: item.id, quote: "This product has a million customers" }], [item])).toBe(false);
    expect(hasSourceQuotes(claim, [{ evidenceId: item.id, quote: item.snippet! }], [item])).toBe(true);
  });
  it("requires support for every cited source", () => {
    const a = evidence(), b = evidence();
    expect(hasSourceQuotes({ title: "Claim", body: "Claim", evidenceIds: [a.id, b.id] }, [{ evidenceId: a.id, quote: a.snippet! }], [a, b])).toBe(false);
  });
  it("drops statements the independent reviewer rejects", async () => {
    const item = evidence();
    vi.spyOn(languageProvider, "structured").mockResolvedValue({ reviews: [{ index: 0, supported: false, quotes: [{ evidenceId: item.id, quote: item.snippet }] }] });
    expect(await groundedClaims([{ title: "Claim", body: "Claim", evidenceIds: [item.id] }], [item])).toEqual([]);
  });
});

it("exports all sources, excluded results, multiple pages, and clickable URLs", async () => {
  const items = Array.from({ length: 35 }, (_, index) => evidence({ title: `UniqueSource${index}`, type: index < 8 ? "PATENT" : "RESEARCH", retained: index !== 34, url: `https://example.com/source/${index}` }));
  const value = report(items);
  const pdf = await createReportPdf(snapshot(value), value);
  const output = pdf.output();
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  expect(output).toContain("UniqueSource34");
  expect(output).toContain("Excluded");
  expect(output).toContain("/URI (https://example.com/source/34)");
  expect(output).toContain("UniqueSource7");
});


it("prioritizes market evidence and checkpoints solutions before a later batch fails", async () => {
  const market = Array.from({ length: 8 }, () => evidence({ relevanceScore: 45 }));
  const paper = evidence({ type: "RESEARCH", relevanceScore: 99 });
  const provider = vi.spyOn(languageProvider, "structured")
    .mockResolvedValueOnce({ items: [{ evidenceId: market[0].id, concepts: [], entityName: "TrailPack", entityType: "PRODUCT", entitySummary: "Backpack" }] })
    .mockRejectedValueOnce(new Error("Usage limit"));
  let saved: Entity[] = [];
  await expect(classify(idea, [paper, ...market], (entities) => { saved = entities; })).rejects.toThrow("Usage limit");
  const supplied = provider.mock.calls[0][1] as { evidence: { id: string }[] };
  expect(supplied.evidence.map((item) => item.id)).toEqual(market.map((item) => item.id));
  expect(saved[0].name).toBe("TrailPack");
  expect(saved[0].evidenceIds).toEqual([market[0].id]);
});

it("shows real unclassified sources in older partial reports and PDF exports", async () => {
  const source = evidence({ title: "SmartCane", snippet: "Original source excerpt" });
  const value = report([source, evidence({ retained: false }), evidence({ type: "RESEARCH" }), evidence({ duplicateOf: source.id })]);
  value.warnings = ["Concept and entity extraction incomplete: Provider unavailable"];
  expect(solutionsState(value).candidates.map((item) => item.id)).toEqual([source.id]);
  const html = renderToStaticMarkup(createElement(ReportView, { analysis: snapshot(value), report: value }));
  const section = html.slice(html.indexOf('id="solutions"'), html.indexOf('id="patents"'));
  expect(section).toContain("SmartCane");
  expect(section).toContain("classification incomplete");
  expect(section).not.toContain("No named products");
  const pdf = await createReportPdf(snapshot(value), value);
  expect(pdf.output()).toContain("Potential solutions - classification incomplete");
});

it("does not repeat identified sources as unverified candidates or change counts", () => {
  const item = evidence(); const value = report([item]);
  value.classificationComplete = false;
  value.entities = [{ id: "entity", name: "TrailPack", type: "PRODUCT", summary: "Source excerpt", evidenceIds: [item.id], similarity: 80 }];
  expect(solutionsState(value).candidates).toEqual([]);
  expect(value.overview.PRODUCT).toBe(0);
});

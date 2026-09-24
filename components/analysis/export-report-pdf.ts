import { solutionsState } from "@/src/lib/solutions";
import type { AnalysisSnapshot, Report } from "@/src/lib/contracts";
import { safeUrl } from "@/src/lib/urls";
import { officialSearchUrl } from "@/src/lib/search-url";

// Export from data, independent of expanded sections, filters, pagination, or theme.
export async function createReportPdf(analysis: AnalysisSnapshot, report: Report) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - 20;
  let y = margin;
  const ensure = (height: number) => { if (y + height > bottom) { pdf.addPage(); y = margin; } };
  const paragraph = (text: string, size = 10, bold = false, url?: string) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(url ? 35 : 40, url ? 85 : 40, url ? 135 : 40);
    const lines = pdf.splitTextToSize(text, width) as string[];
    const height = size * 0.45;
    for (const line of lines) {
      ensure(height);
      pdf.text(line, margin, y + height);
      if (url) pdf.link(margin, y, Math.min(width, pdf.getTextWidth(line)), height + 1, { url });
      y += height;
    }
    y += 3;
  };
  const heading = (text: string) => { ensure(24); y += 4; paragraph(text, 15, true); };
  const references = (ids: string[]) => paragraph("Sources: " + ids.map((id) => {
    const index = report.evidence.findIndex((item) => item.id === id);
    return index >= 0 ? `[${index + 1}]` : "Unavailable";
  }).join(", "), 9);
  const link = (url: string | undefined) => { const safe = safeUrl(url); if (safe) paragraph(safe, 9, false, safe); };
  pdf.setProperties({ title: `IdeaXray - ${report.decomposition.title}`, subject: analysis.originalIdea.slice(0, 180) });
  paragraph("IdeaXray research report", 20, true);
  paragraph(report.decomposition.title, 16, true);
  paragraph(`${analysis.region} | ${report.generatedAt} | ${analysis.status}`, 9);
  paragraph(analysis.originalIdea);
  if (report.warnings.length) { heading("Limitations"); report.warnings.forEach((warning) => paragraph(warning)); }
  heading("Overview");
  paragraph("Problem: " + report.decomposition.problem);
  paragraph("Proposed mechanism: " + report.decomposition.solution);
  paragraph("Target users: " + report.decomposition.targetUsers.join(", "));
  paragraph("Technologies: " + report.decomposition.technologies.join(", "));
  paragraph("Concepts: " + report.decomposition.concepts.join(", "));
  paragraph(Object.entries(report.overview).map(([type, count]) => `${type}: ${count}`).join(" | "));
  paragraph("AI interpretations require human review; confidence labels are qualitative, not measured probabilities.");
  report.findings.forEach((finding) => { paragraph(finding.title, 12, true); paragraph(finding.body); paragraph("AI confidence: " + finding.confidence, 9); references(finding.evidenceIds); });
  heading("Landscape indicators");
  report.indicators.forEach((indicator) => {
    paragraph(`${indicator.name}: ${indicator.value === null ? "N/A" : indicator.value + (indicator.name === "Public Interest Momentum" ? "%" : "/100")}`, 12, true);
    paragraph(indicator.explanation); references(indicator.evidenceIds);
  });
  heading("Existing solutions");
  const solutions = solutionsState(report);
  if (solutions.incomplete) paragraph("Solution identification could not finish. Missing entries do not mean no solutions exist.");
  else if (!report.entities.length && !solutions.candidates.length) paragraph("No supported named solutions were extracted.");
  report.entities.forEach((entity) => { paragraph(`${entity.name} (${entity.type})`, 12, true); paragraph(entity.summary); references(entity.evidenceIds); });
  if (solutions.candidates.length) {
    heading(report.sourceFirst ? "Product listings and related sources" : "Potential solutions - classification incomplete");
    paragraph("Unverified search results, not confirmed products or companies. Titles and excerpts come from sources.");
    solutions.candidates.forEach((item) => { paragraph(item.title, 12, true); paragraph(item.snippet ?? "No excerpt supplied."); if (typeof item.metadata.price === "string") paragraph("Listed price: " + item.metadata.price + " (may change)"); references([item.id]); });
  }
  for (const [type, title] of [["PATENT", "Patents"], ["RESEARCH", "Academic research"]]) {
    heading(title);
    const items = report.evidence.filter((item) => item.retained && item.type === type);
    if (!items.length) paragraph("No retained sources in this category.");
    items.forEach((item) => { paragraph(item.title, 12, true); paragraph(item.snippet ?? "No source excerpt supplied."); references([item.id]); link(item.url); });
  }
  heading("History");
  report.timeline.forEach((event) => { paragraph(`${event.precision === "year" ? event.date.slice(0, 4) : event.date.slice(0, 10)}: ${event.title}`); references(event.evidenceIds); });
  heading("Concept coverage and opportunities");
  report.coverage.forEach((row) => { paragraph(`${row.concept}: patents ${row.patents}, research ${row.research}, products ${row.products}, web/market ${row.web}; ${row.level} coverage.`); references(row.evidenceIds); });
  report.gaps.forEach((gap) => { paragraph(gap.title, 12, true); paragraph(gap.body); paragraph(gap.rationale); paragraph("AI confidence: " + gap.confidence, 9); references(gap.evidenceIds); });
  if (report.relatedSearches?.length) {
    heading("Related searches returned by Google");
    paragraph("Suggestions for further research, not evidence of demand.");
    report.relatedSearches.forEach((entry) => { paragraph(entry.query); link("https://www.google.com/search?q=" + encodeURIComponent(entry.query)); });
  }
  heading("Search trace");
  report.trace.forEach((run) => {
    paragraph(`${run.engine}: ${run.query}`, 12, true);
    paragraph(`${run.purpose} | ${run.status} | ${run.resultCount} received, ${run.retainedCount} retained | ${run.attempts} remote attempts | ${run.durationMs} ms | Search ID: ${run.serpApiSearchId ?? "Unavailable"}`);
    if (run.error) paragraph(run.error);
    link(run.officialUrl ?? officialSearchUrl(run.engine, run.query));
  });
  heading("Methodology"); paragraph(report.methodology);
  heading("Complete evidence appendix");
  paragraph("Includes every retained, excluded, and duplicate source. Numbers match report citations.");
  report.evidence.forEach((item, index) => {
    paragraph(`[${index + 1}] ${item.title}`, 12, true);
    paragraph(`${item.type} | ${item.retained ? "Retained" : item.duplicateOf ? "Excluded duplicate" : "Excluded"} | Relevance ${item.relevanceScore}/100`, 9);
    paragraph(item.snippet ?? "No source excerpt supplied."); link(item.url);
    paragraph(`Source: ${item.source ?? "Unavailable"} | Date: ${item.sourceDate ?? "Unavailable"} | Search ID: ${item.serpApiSearchId ?? "Unavailable"}`, 9);
    paragraph("Query: " + item.query, 9);
    Object.entries(item.metadata).filter(([, value]) => value !== undefined && value !== null).forEach(([key, value]) => {
      paragraph(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`, 9);
    });
  });
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(90);
    pdf.text(`IdeaXray | ${page} / ${pdf.getNumberOfPages()}`, margin, bottom + 12);
  }
  return pdf;
}

export async function exportReportPdf(analysis: AnalysisSnapshot, report: Report) {
  const pdf = await createReportPdf(analysis, report);
  const slug = report.decomposition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "report";
  pdf.save(`ideaxray-${slug}.pdf`);
}

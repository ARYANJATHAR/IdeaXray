import { solutionsState } from "@/src/lib/solutions";
import type { AnalysisSnapshot, EvidenceItem, Report } from "@/src/lib/contracts";
import { safeUrl } from "@/src/lib/urls";

// Client-side export. The tables contain report data directly and never make network requests.
export async function createReportPdf(analysis: AnalysisSnapshot, report: Report) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const rightX = pageWidth - marginX - 205;
  const muted: [number, number, number] = [105, 111, 122];
  const ink: [number, number, number] = [28, 31, 38];
  const primary: [number, number, number] = [34, 39, 52];
  const secondary: [number, number, number] = [94, 110, 224];
  const citations = (ids: string[]) => ids.map((id) => {
    const index = report.evidence.findIndex((item) => item.id === id);
    return index >= 0 ? `[${index + 1}]` : "";
  }).filter(Boolean).join(", ");
  const compact = (value: string | undefined, limit = 360) => {
    const clean = (value ?? "").replace(/\s+/g, " ").trim();
    return clean.length > limit ? clean.slice(0, limit - 1).trimEnd() + "…" : clean;
  };
  const detail = (item: EvidenceItem) => {
    const fields = [item.source, item.sourceDate?.slice(0, 10)];
    if (item.type === "PATENT" && typeof item.metadata.publicationNumber === "string") fields.push(item.metadata.publicationNumber);
    if (item.type === "TREND" && Array.isArray(item.metadata.points)) {
      const points = item.metadata.points.filter((point): point is { date: string; value: number } => Boolean(point && typeof point === "object" && "date" in point && typeof point.date === "string" && "value" in point && typeof point.value === "number"));
      const dates = points.map((point) => point.date).sort();
      fields.push(points.length ? `Google Trends: ${points.length} readings (${dates[0]?.slice(0, 10)} to ${dates.at(-1)?.slice(0, 10)}); latest ${points.at(-1)?.value}/100` : "Google Trends relative interest");
    }
    return fields.filter(Boolean).join(" | ") || "Source details unavailable";
  };
  doc.setProperties({ title: `IdeaXray - ${report.decomposition.title}`, subject: analysis.originalIdea.slice(0, 180), author: "IdeaXray" });

  // Report heading and paired metadata block.
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...ink);
  doc.text("IdeaXray Research Report", marginX, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...muted);
  const leftMetadata = [
    ["Entity", report.decomposition.title],
    ["Research region", analysis.region],
    ["Period", new Date(report.generatedAt).toLocaleDateString()],
  ];
  const rightMetadata = [
    ["Report status", analysis.status],
    ["Evidence items", String(report.evidence.length)],
    ["AI analysis", report.aiEnrichment === false ? "Unavailable" : "Included where supported"],
  ];
  const drawMetadata = (rows: string[][], x: number, labelWidth: number, valueWidth: number) => rows.forEach(([label, value], index) => {
    const rowY = 64 + index * 14;
    doc.setFont("helvetica", "bold"); doc.text(`${label}:`, x, rowY, { maxWidth: labelWidth });
    doc.setFont("helvetica", "normal");
    const text = doc.splitTextToSize(value || "Not specified", valueWidth) as string[];
    doc.text(text[0] ?? "Not specified", x + labelWidth + 6, rowY);
  });
  drawMetadata(leftMetadata, marginX, 92, rightX - marginX - 104);
  drawMetadata(rightMetadata, rightX, 78, pageWidth - marginX - rightX - 84);
  doc.setDrawColor(220, 223, 230); doc.setLineWidth(0.7); doc.line(marginX, 98, pageWidth - marginX, 98);

  const primaryRows = [
    ...report.findings.map((finding) => [finding.title, finding.body, `${finding.confidence} confidence`, citations(finding.evidenceIds)]),
    ...report.gaps.map((gap) => [gap.title, `${gap.body} Why investigate: ${gap.rationale}`, `Opportunity · ${gap.confidence}`, citations(gap.evidenceIds)]),
  ];
  if (!primaryRows.length) primaryRows.push(["No verified AI takeaways", "Review the evidence and search activity below. Empty findings do not establish that no relevant information exists.", "Review sources", ""]);
  autoTable(doc, {
    startY: 108,
    head: [["Research takeaway", "Summary", "Assessment", "Sources"]],
    body: primaryRows,
    theme: "grid",
    margin: { left: marginX, right: marginX, top: 40, bottom: 42 },
    tableWidth: contentWidth,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, textColor: ink, overflow: "linebreak", valign: "top", lineColor: [218, 222, 229], lineWidth: 0.45 },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [247, 248, 250] },
    columnStyles: { 0: { cellWidth: 115, fontStyle: "bold" }, 1: { cellWidth: 220 }, 2: { cellWidth: 85 }, 3: { cellWidth: "auto", textColor: secondary } },
    didDrawPage: () => { /* footer is added once all pages are known */ },
  });
  const primaryFinalY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 108;

  const solutions = solutionsState(report);
  const allSources = report.evidence;
  const evidenceRows = allSources.map((item) => {
    const status = item.retained ? "Retained" : item.duplicateOf ? "Duplicate" : "Excluded";
    const solutionMark = solutions.candidates.some((candidate) => candidate.id === item.id) ? "Potential solution · " : "";
    return [
      item.type,
      `${solutionMark}${item.title}
${compact(item.snippet, 300) || "No source excerpt supplied."}`,
      detail(item),
      `${item.relevanceScore}/100 · ${status}`,
      safeUrl(item.url) ? "Open source" : "—",
    ];
  });
  if (!evidenceRows.length) evidenceRows.push(["—", "No search evidence was saved for this report.", "", "—", "—"]);
  autoTable(doc, {
    startY: primaryFinalY + 14,
    head: [["Type", "Evidence and excerpt", "Source details", "Relevance / status", "Link"]],
    body: evidenceRows,
    theme: "grid",
    margin: { left: marginX, right: marginX, top: 40, bottom: 42 },
    tableWidth: contentWidth,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: ink, overflow: "linebreak", valign: "top", lineColor: [218, 222, 229], lineWidth: 0.4 },
    headStyles: { fillColor: secondary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: 175 }, 2: { cellWidth: 120 }, 3: { cellWidth: 92 }, 4: { cellWidth: "auto", textColor: secondary, fontStyle: "bold" } },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4) return;
      const url = safeUrl(allSources[data.row.index]?.url);
      if (url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
    },
  });
  const finalY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? primaryFinalY;

  // Summary follows the last table, moving to a clean page if necessary.
  let summaryY = finalY + 20;
  if (summaryY + 34 > pageHeight - 42) { doc.addPage(); summaryY = 48; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...ink);
  doc.text("Research summary", marginX, summaryY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted);
  const counts = Object.entries(report.overview).filter(([, count]) => count > 0).map(([type, count]) => `${count} ${type.toLowerCase()}`).join(" · ") || "No retained evidence counts";
  const summary = `Region: ${analysis.region}. ${counts}. ${report.warnings.length ? `${report.warnings.length} coverage limitation(s) are noted in the report.` : "Use the cited sources to verify each interpretation."}`;
  const summaryLines = doc.splitTextToSize(summary, contentWidth) as string[];
  doc.text(summaryLines, marginX, summaryY + 14);

  // Research attribution is the appropriate closing block for this report; no signature is implied.
  const closingY = Math.max(summaryY + 14 + summaryLines.length * 11 + 16, pageHeight - 66);
  doc.setDrawColor(155, 164, 184); doc.setLineWidth(0.7); doc.line(rightX, closingY, rightX + 180, closingY);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ink);
  doc.text("IdeaXray", rightX, closingY + 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text("Evidence-backed research support", rightX, closingY + 25);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(220, 223, 230); doc.setLineWidth(0.5); doc.line(marginX, pageHeight - 24, pageWidth - marginX, pageHeight - 24);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text("IDEAXRAY  ·  RESEARCH SUPPORT", marginX, pageHeight - 12);
    doc.text(`${page} / ${pageCount}`, pageWidth - marginX, pageHeight - 12, { align: "right" });
  }
  return doc;
}

export async function exportReportPdf(analysis: AnalysisSnapshot, report: Report) {
  const doc = await createReportPdf(analysis, report);
  const slug = report.decomposition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "report";
  doc.save(`ideaxray-${slug}.pdf`);
}

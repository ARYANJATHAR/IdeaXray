import type { AnalysisSnapshot, Report } from "@/src/lib/contracts";

export async function exportReportPdf(analysis: AnalysisSnapshot, report: Report, element: HTMLElement) {
  const [{ jsPDF }, html2canvas] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const canvas = await html2canvas.default(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    onclone: (doc) => {
      const cloned = doc.querySelector(".report");
      if (!(cloned instanceof HTMLElement)) return;
      cloned.querySelectorAll(".report-nav, .button, details summary").forEach((node) => {
        if (node instanceof HTMLElement) node.style.breakInside = "avoid";
      });
    },
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  const image = canvas.toDataURL("image/png");
  let offset = 0;

  pdf.setProperties({
    title: `IdeaXray — ${report.decomposition.title}`,
    subject: analysis.originalIdea.slice(0, 180),
  });

  while (offset < imageHeight) {
    pdf.addImage(image, "PNG", 0, -offset, imageWidth, imageHeight);
    offset += pageHeight;
    if (offset < imageHeight) pdf.addPage();
  }

  const slug = report.decomposition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "report";
  pdf.save(`ideaxray-${slug}.pdf`);
}

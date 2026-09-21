"use client";
import { useRef, useState } from "react";
import { IconDownload, IconArrowUpRight } from "@tabler/icons-react";
import type { AnalysisSnapshot, EvidenceItem, Report } from "@/src/lib/contracts";
import { Citations, EvidenceBrowser, EvidenceDialog, metadataText, SourceLink } from "@/components/evidence/evidence-browser";
import { exportReportPdf } from "@/components/analysis/export-report-pdf";
import { officialSearchLabel, officialSearchUrl } from "@/src/lib/search-url";

const navigation = [
  ["summary", "Overview"], ["solutions", "Solutions"], ["patents", "Patents"], ["research", "Research"],
  ["history", "History"], ["opportunities", "Opportunities"], ["search-trace", "Search trace"], ["sources", "Sources"],
];

function Empty({ children }: { children: React.ReactNode }) { return <p className="empty-state">{children}</p>; }

export function ReportView({ analysis, report }: { analysis: AnalysisSnapshot; report: Report }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [allPatents, setAllPatents] = useState(false);
  const [allResearch, setAllResearch] = useState(false);
  const [exporting, setExporting] = useState(false);
  const retained = report.evidence.filter((item) => item.retained);
  const patents = retained.filter((item) => item.type === "PATENT").sort((a, b) => b.relevanceScore - a.relevanceScore);
  const papers = retained.filter((item) => item.type === "RESEARCH").sort((a, b) => b.relevanceScore - a.relevanceScore);
  const cite = (ids: string[]) => <Citations ids={ids} evidence={report.evidence} onSelect={setSelectedId} />;

  async function exportReport() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportReportPdf(analysis, report, reportRef.current);
    } catch {
      window.alert("Could not build the PDF. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  function sourceCard(item: EvidenceItem) {
    return <article className="landscape-entry" key={item.id}>
      <div className="source-meta"><span>{item.type === "PATENT" ? metadataText(item.metadata.publicationNumber) : metadataText(item.metadata.year)}</span><span>{item.relevanceScore}/100 similarity</span></div>
      <h3><button className="source-title" onClick={() => setSelectedId(item.id)}>{item.title}</button></h3>
      <p>{item.snippet ?? "No summary was supplied by this source."}</p>
      <dl className="compact-details">{item.type === "PATENT" ? <><dt>Inventor</dt><dd>{metadataText(item.metadata.inventor)}</dd><dt>Assignee</dt><dd>{metadataText(item.metadata.assignee)}</dd><dt>Priority / filing</dt><dd>{metadataText(item.metadata.priorityDate ?? item.metadata.filingDate)}</dd></> : <><dt>Publication</dt><dd>{metadataText(item.metadata.publicationInfo)}</dd><dt>Authors</dt><dd>{metadataText(item.metadata.authors)}</dd><dt>Cited by</dt><dd>{metadataText(item.metadata.citedBy)}</dd></>}</dl>
      <div className="source-actions"><SourceLink url={item.url} />{cite([item.id])}</div>
    </article>;
  }

  return <div className="report" ref={reportRef}>
    <header className="report-heading card report-hero"><div><p className="eyebrow">{analysis.status === "PARTIAL" ? "Research report · partial coverage" : "Your research report"}</p><h1>{report.decomposition.title}</h1><p>{analysis.region} research · {new Date(report.generatedAt).toLocaleDateString()}</p></div><button className="button button-secondary" onClick={() => void exportReport()} disabled={exporting}><IconDownload size={17} aria-hidden="true" />{exporting ? "Building PDF…" : "Download PDF"}</button></header>
    {report.warnings.length > 0 && <aside className="report-warning"><h2>Read with these limitations</h2><ul>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside>}
    <nav className="report-nav" aria-label="Report sections">{navigation.map(([id, label]) => <a key={id} href={"#" + id}>{label}</a>)}</nav>
    <section id="summary" className="report-section"><div className="report-section-heading"><span>01</span><h2>Your idea, in context.</h2></div>
      <p className="original-idea">{analysis.originalIdea}</p>
      <div className="idea-summary-grid"><div><h3>The problem</h3><p>{report.decomposition.problem}</p></div><div><h3>Proposed mechanism</h3><p>{report.decomposition.solution}</p></div><div><h3>Who it helps</h3><p>{report.decomposition.targetUsers.join(", ") || "Not specified"}</p></div><div><h3>Core technologies</h3><p>{report.decomposition.technologies.join(", ") || "Not specified"}</p></div></div>
      <div className="concepts" aria-label="Search concepts">{report.decomposition.concepts.map((concept) => <span key={concept}>{concept}</span>)}</div>
      <div className="overview-counts">{[["Relevant patents", report.overview.PATENT], ["Research papers", report.overview.RESEARCH], ["Product sources", report.overview.PRODUCT], ["Companies / projects", report.entities.length], ["News evidence", report.overview.NEWS]].map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
      <p className="muted">Counts describe retained, deduplicated evidence and extracted entities, not total search hits.</p>
      {report.findings.length > 0 && <div className="findings">{report.findings.map((finding) => <article key={finding.title}><h3>{finding.title}</h3><p>{finding.body} {cite(finding.evidenceIds)}</p><span className="confidence">{finding.confidence} confidence</span></article>)}</div>}
      <h3 className="subsection-title">Landscape indicators</h3>
      <p className="methodology-disclaimer">IdeaXray landscape indicators are research heuristics, not legal, investment, or patentability assessments.</p>
      <div className="indicator-grid">{report.indicators.map((indicator) => <article key={indicator.name}><h4>{indicator.name}</h4><strong>{indicator.value === null ? "N/A" : indicator.name === "Public Interest Momentum" ? (indicator.value > 0 ? "+" : "") + indicator.value + "%" : indicator.value + "/100"}</strong><p>{indicator.explanation}</p>{indicator.evidenceIds.length > 0 && <details><summary>Supporting evidence</summary>{cite(indicator.evidenceIds)}</details>}</article>)}</div>
    </section>
    <section id="solutions" className="report-section"><div className="report-section-heading"><span>02</span><h2>Existing solutions.</h2></div>
      {report.entities.length ? <div className="solutions-grid">{report.entities.map((entity) => {
        const sources = retained.filter((item) => entity.evidenceIds.includes(item.id)); const price = sources.find((item) => item.metadata.price)?.metadata.price;
        return <article className="solution-card" key={entity.id}><div className="source-meta"><span>{entity.type.toLowerCase()}</span><span>{entity.similarity}/100 similarity</span></div><h3>{entity.name}</h3><p>{entity.summary}</p>{price ? <p className="solution-price">{metadataText(price)} <span>price from source; may change</span></p> : null}<div className="source-actions"><SourceLink url={sources.find((item) => item.url)?.url} />{cite(entity.evidenceIds)}</div></article>;
      })}</div> : <Empty>No named products or companies could be established from the retained evidence.</Empty>}
    </section>
    <section id="patents" className="report-section"><div className="report-section-heading"><span>03</span><h2>The patent landscape.</h2></div><p className="section-intro">Related inventions provide context. Similarity does not establish infringement or patentability.</p>
      {patents.length ? <>{(allPatents ? patents : patents.slice(0, 5)).map(sourceCard)}{patents.length > 5 && <button className="button button-secondary" onClick={() => setAllPatents(!allPatents)}>{allPatents ? "Show fewer patents" : "View all " + patents.length + " patents"}</button>}</> : <Empty>No patent evidence passed the relevance filter. This does not establish novelty.</Empty>}
    </section>
    <section id="research" className="report-section"><div className="report-section-heading"><span>04</span><h2>Research worth reading.</h2></div>
      {papers.length ? <>{(allResearch ? papers : papers.slice(0, 5)).map(sourceCard)}{papers.length > 5 && <button className="button button-secondary" onClick={() => setAllResearch(!allResearch)}>{allResearch ? "Show fewer papers" : "View all " + papers.length + " papers"}</button>}</> : <Empty>No academic papers passed the relevance filter.</Empty>}
    </section>
    <section id="history" className="report-section"><div className="report-section-heading"><span>05</span><h2>How the idea got here.</h2></div><p className="section-intro">A chronology of dated evidence. Undated sources are left out.</p>
      {report.timeline.length ? <ol className="timeline">{report.timeline.map((event) => <li key={event.id}><time dateTime={event.precision === "year" ? event.date.slice(0, 4) : event.date.slice(0, 10)}>{event.precision === "year" ? event.date.slice(0, 4) : event.date.slice(0, 10)}</time><div><span className="source-meta">{event.type.toLowerCase()}</span><h3>{event.title}</h3>{cite(event.evidenceIds)}</div></li>)}</ol> : <Empty>No reliable dates were available to reconstruct a history.</Empty>}
    </section>
    <section id="opportunities" className="report-section"><div className="report-section-heading"><span>06</span><h2>Where to look closer.</h2></div><p className="section-intro">Lower coverage can suggest a research question. It is never guaranteed white space.</p>
      <div className="table-scroll"><table className="coverage-table"><caption>Concept coverage among retained sources</caption><thead><tr><th>Concept</th><th>Patents</th><th>Research</th><th>Products</th><th>Web / market</th><th>Coverage</th><th>Evidence</th></tr></thead><tbody>{report.coverage.map((row) => <tr key={row.concept}><th scope="row">{row.concept}</th><td>{row.patents}</td><td>{row.research}</td><td>{row.products}</td><td>{row.web}</td><td><span className="status-chip">{row.level}</span></td><td>{row.evidenceIds.length ? <details><summary>{row.evidenceIds.length} sources</summary>{cite(row.evidenceIds)}</details> : "None"}</td></tr>)}</tbody></table></div>
      <div className="gap-list">{report.gaps.map((gap) => <article key={gap.id}><span className="confidence">{gap.confidence} confidence · potential area to investigate</span><h3>{gap.title}<IconArrowUpRight size={22} aria-hidden="true" /></h3><p>{gap.body}</p><p className="gap-rationale">{gap.rationale}</p>{cite(gap.evidenceIds)}</article>)}</div>
      {!report.gaps.length && <Empty>The current evidence does not support a defensible opportunity gap. Broaden or refine the idea rather than interpreting missing evidence as novelty.</Empty>}
    </section>
    <section id="search-trace" className="report-section"><div className="report-section-heading"><span>07</span><h2>Follow the search.</h2></div><p className="section-intro">Every search, its purpose, and the evidence it contributed.</p>
      <div className="table-scroll"><table className="trace-table"><thead><tr><th>Engine / purpose</th><th>Query / links</th><th>Received</th><th>Retained</th><th>Duration</th><th>Status</th></tr></thead><tbody>{report.trace.map((run) => {
        const officialUrl = run.officialUrl ?? officialSearchUrl(run.engine, run.query);
        return <tr key={run.id}><td><strong>{run.engine}</strong><small>{run.purpose}</small></td><td><span>{run.query}</span><div className="trace-links"><SourceLink url={officialUrl}>Open on {officialSearchLabel(run.engine)}</SourceLink></div><small>{run.serpApiSearchId ?? "No search ID"} · {run.attempts} remote attempt{run.attempts === 1 ? "" : "s"}</small>{run.error && <small>{run.error}</small>}</td><td>{run.resultCount}</td><td>{run.retainedCount}</td><td>{(run.durationMs / 1000).toFixed(1)}s</td><td><span className="status-chip">{run.status.toLowerCase()}</span></td></tr>;
      })}</tbody></table></div>
      <details className="methodology"><summary>How this report was assembled</summary><p>{report.methodology}</p></details>
    </section>
    <section id="sources" className="report-section"><div className="report-section-heading"><span>08</span><h2>The evidence is yours to inspect.</h2></div><EvidenceBrowser evidence={report.evidence} onSelect={setSelectedId} /></section>
    <EvidenceDialog item={report.evidence.find((item) => item.id === selectedId)} onClose={() => setSelectedId(undefined)} />
  </div>;
}

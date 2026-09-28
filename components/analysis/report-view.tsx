"use client";
import { solutionsState } from "@/src/lib/solutions";
import { useState } from "react";
import Link from "next/link";
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
  const [activeSection, setActiveSection] = useState("summary");
  const [allSolutions, setAllSolutions] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [allPatents, setAllPatents] = useState(false);
  const [allResearch, setAllResearch] = useState(false);
  const [exporting, setExporting] = useState(false);
  const solutions = solutionsState(report);
  const retained = report.evidence.filter((item) => item.retained);
  const patentResults = report.evidence.filter((item) => item.type === "PATENT").sort((a, b) => Number(b.retained) - Number(a.retained) || b.relevanceScore - a.relevanceScore);
  const patents = patentResults;
  const relevantPatentCount = patentResults.filter((item) => item.retained).length;
  const papers = retained.filter((item) => item.type === "RESEARCH").sort((a, b) => b.relevanceScore - a.relevanceScore);
  const cite = (ids: string[]) => <Citations ids={ids} evidence={report.evidence} onSelect={setSelectedId} />;

  function coverageMessage(engine: string) {
    const runs = report.trace.filter((run) => run.engine === engine);
    if (!runs.length) return "This source was not searched in this report.";
    if (runs.every((run) => run.status === "FAILED" || run.status === "SKIPPED")) return "This search was unavailable or skipped. Open Search trace to see why.";
    const received = runs.reduce((total, run) => total + run.resultCount, 0);
    return received ? `${received} results were returned, but none passed the relevance filter. You can inspect unfiltered results in Sources.` : "This query returned no results. Try a shorter description focused on the core function.";
  }

  async function exportReport() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      await exportReportPdf(analysis, report);
    } catch {
      setExportError("Could not build the PDF. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  function sourceCard(item: EvidenceItem) {
    return <article className="landscape-entry" key={item.id}>
      <div className="source-meta"><span>{item.type === "PATENT" ? metadataText(item.metadata.publicationNumber) : metadataText(item.metadata.year)}</span><span>{item.retained ? "Relevant match" : item.duplicateOf ? "Duplicate result" : "Review match"} · {item.relevanceScore}/100</span></div>
      <h3><button className="source-title" onClick={() => setSelectedId(item.id)}>{item.title}</button></h3>
      <p>{item.snippet ?? "No summary was supplied by this source."}</p>
      <details><summary>Source details</summary><dl className="compact-details">{item.type === "PATENT" ? <><dt>Inventor</dt><dd>{metadataText(item.metadata.inventor)}</dd><dt>Assignee</dt><dd>{metadataText(item.metadata.assignee)}</dd><dt>Priority / filing</dt><dd>{metadataText(item.metadata.priorityDate ?? item.metadata.filingDate)}</dd></> : <><dt>Publication</dt><dd>{metadataText(item.metadata.publicationInfo)}</dd><dt>Authors</dt><dd>{metadataText(item.metadata.authors)}</dd><dt>Cited by</dt><dd>{metadataText(item.metadata.citedBy)}</dd></>}</dl></details>
      <div className="source-actions"><SourceLink url={item.url} />{cite([item.id])}</div>
    </article>;
  }

  return <div className="report">
    <header className="report-heading card report-hero"><div><p className="eyebrow">{analysis.status === "PARTIAL" ? "Research report · partial coverage" : "Your research report"}</p><h1>{report.decomposition.title}</h1><p>{analysis.region} research · {new Date(report.generatedAt).toLocaleDateString()}</p></div><button className="button button-secondary" onClick={() => void exportReport()} disabled={exporting}><IconDownload size={17} aria-hidden="true" />{exporting ? "Building PDF…" : "Download PDF"}</button></header>
    {exportError && <p role="alert" className="notice">{exportError}</p>}
    {report.warnings.length > 0 && <details className="report-warning"><summary>{report.warnings.length} research limitations — review coverage</summary><ul>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
    <nav className="report-nav" aria-label="Report sections">{navigation.map(([id, label]) => <button key={id} type="button" aria-pressed={activeSection === id} onClick={() => setActiveSection(id)}>{label}</button>)}</nav>
    <section hidden={activeSection !== "summary"} id="summary" className="report-section"><div className="report-section-heading"><span>01</span><h2>Your idea, in context.</h2></div>
      {report.sourceFirst && <p className="muted">Source-first research: product listings and excerpts come from search results. Their presence does not establish that they are direct competitors.{report.aiEnrichment === false ? " Optional AI interpretation was not enabled for this report." : " AI highlights below are checked against source excerpts."}</p>}
      <details className="brief-disclosure"><summary>Your idea & search concepts</summary><p className="original-idea">{analysis.originalIdea}</p>
      <div className="idea-summary-grid"><div><h3>The problem</h3><p>{report.decomposition.problem}</p></div><div><h3>Proposed mechanism</h3><p>{report.decomposition.solution}</p></div><div><h3>Who it helps</h3><p>{report.decomposition.targetUsers.join(", ") || "Not specified"}</p></div><div><h3>Core technologies</h3><p>{report.decomposition.technologies.join(", ") || "Not specified"}</p></div></div>
      <div className="concepts" aria-label="Search concepts">{report.decomposition.concepts.map((concept) => <span key={concept}>{concept}</span>)}</div>
      </details><div className="report-explore-grid">{[["patents", "Patents found", patents.length, "Review related inventions"], ["solutions", "Potential solutions", solutions.candidates.length + report.entities.length, "See what already exists"], ["research", "Research papers", papers.length, "Explore the science"]].map(([id, label, count, hint]) => <button key={id} className="explore-card" onClick={() => setActiveSection(String(id))}><span>{label}</span><strong>{count}</strong><span>{hint} ↗</span></button>)}</div>
      <h3 className="subsection-title">Your quick take</h3>
      {!report.findings.length && <div className="ai-empty-state"><span className="ai-empty-mark" aria-hidden="true">✳</span><div><h4>{report.aiEnrichment === false ? "AI analysis was turned off" : report.warnings.some((warning) => warning.startsWith("Report synthesis incomplete:")) ? "The AI summary could not finish" : "No takeaways passed the source check"}</h4><p>{report.aiEnrichment === false ? "Your search results are ready to explore." : report.warnings.some((warning) => warning.startsWith("Report synthesis incomplete:")) ? "The sources are saved. You can review them or try a fresh analysis." : "The sources are saved, but the AI did not return claims that passed citation checks."}</p><Link className="button button-secondary" href={`/analyze?idea=${encodeURIComponent(analysis.originalIdea)}`}>Try a fresh analysis</Link></div></div>}
      {report.findings.length > 0 && <div className="findings">{report.findings.map((finding) => <article key={finding.title}><h3>{finding.title}</h3><p>{finding.body} {cite(finding.evidenceIds)}</p><span className="confidence">{finding.confidence} confidence</span></article>)}</div>}
      <details className="brief-disclosure"><summary>Explore landscape indicators</summary>
      <p className="methodology-disclaimer">IdeaXray landscape indicators are research heuristics, not legal, investment, or patentability assessments.</p>
      <div className="indicator-grid">{report.indicators.map((indicator) => <article key={indicator.name}><h4>{indicator.name}</h4><strong>{indicator.value === null ? "N/A" : indicator.name === "Public Interest Momentum" ? (indicator.value > 0 ? "+" : "") + indicator.value + "%" : indicator.value + "/100"}</strong><p>{indicator.explanation}</p>{indicator.evidenceIds.length > 0 && <details><summary>Supporting evidence</summary>{cite(indicator.evidenceIds)}</details>}</article>)}</div>
    </details></section>
    <section hidden={activeSection !== "solutions"} id="solutions" className="report-section"><div className="report-section-heading"><span>02</span><h2>Related products and potential solutions.</h2></div>
      {solutions.incomplete && <p className="notice">Solution identification could not finish. Identified solutions are shown below; other relevant sources remain available for review. Missing entries do not mean no solutions exist.</p>}
      {report.entities.length ? <div className="solutions-grid">{report.entities.map((entity) => {
        const sources = retained.filter((item) => entity.evidenceIds.includes(item.id)); const price = sources.find((item) => item.metadata.price)?.metadata.price;
        return <article className="solution-card" key={entity.id}><div className="source-meta"><span>{entity.type.toLowerCase()}</span><span>{entity.similarity}/100 similarity</span></div><h3>{entity.name}</h3><p>{entity.summary}</p>{price ? <p className="solution-price">{metadataText(price)} <span>price from source; may change</span></p> : null}<div className="source-actions"><SourceLink url={sources.find((item) => item.url)?.url} />{cite(entity.evidenceIds)}</div></article>;
      })}</div> : !solutions.incomplete && !solutions.candidates.length ? <Empty>{coverageMessage("google")} Missing entries do not mean no products exist.</Empty> : null}
      {solutions.candidates.length > 0 && <><h3>{report.sourceFirst ? "Product listings and related sources" : "Potential solutions — classification incomplete"}</h3><p className="muted">These are relevant search results, not confirmed products or companies. Titles and excerpts come directly from the sources.</p><div className="solutions-grid">{(allSolutions ? solutions.candidates : solutions.candidates.slice(0, 6)).map((item) => <article className="solution-card" key={item.id}><span className="source-meta">{item.type === "PRODUCT" ? "Product listing · relevance needs review" : item.metadata.resultSection === "knowledge_graph" ? "Knowledge panel · relevance needs review" : "Related web source · unverified solution"}</span><h3><button className="source-title" onClick={() => setSelectedId(item.id)}>{item.title}</button></h3><p>{item.snippet ?? "No excerpt was supplied by this source."}</p><p className="muted">{item.source}{typeof item.metadata.price === "string" ? " · " + item.metadata.price + " (listed price; may change)" : ""}{typeof item.metadata.rating === "number" ? " · Rating: " + item.metadata.rating : ""}{typeof item.metadata.reviews === "number" ? " · " + item.metadata.reviews + " reviews" : ""}</p><div className="source-actions"><SourceLink url={item.url} />{cite([item.id])}</div></article>)}</div></>}
      {solutions.candidates.length > 6 && <button className="button button-secondary" onClick={() => setAllSolutions(!allSolutions)}>{allSolutions ? "Show fewer" : "Show all " + solutions.candidates.length + " sources"}</button>}
    </section>
    <section hidden={activeSection !== "patents"} id="patents" className="report-section"><div className="report-section-heading"><span>03</span><h2>The patent landscape.</h2></div><p className="section-intro">Related inventions provide context. Similarity does not establish infringement or patentability.</p>
      {patentResults.length ? <><p className="notice">Google Patents returned {patentResults.length} records. {relevantPatentCount} passed the relevance check; other results are included for your review.</p>{(allPatents ? patents : patents.slice(0, 5)).map(sourceCard)}{patents.length > 5 && <button className="button button-secondary" onClick={() => setAllPatents(!allPatents)}>{allPatents ? "Show fewer patents" : "Review all " + patents.length + " patent results"}</button>}</> : <Empty>{coverageMessage("google_patents")} These results do not establish novelty.</Empty>}
    </section>
    <section hidden={activeSection !== "research"} id="research" className="report-section"><div className="report-section-heading"><span>04</span><h2>Research worth reading.</h2></div>
      {papers.length ? <>{(allResearch ? papers : papers.slice(0, 5)).map(sourceCard)}{papers.length > 5 && <button className="button button-secondary" onClick={() => setAllResearch(!allResearch)}>{allResearch ? "Show fewer papers" : "View all " + papers.length + " papers"}</button>}</> : <Empty>{coverageMessage("google_scholar")}</Empty>}
    </section>
    <section hidden={activeSection !== "history"} id="history" className="report-section"><div className="report-section-heading"><span>05</span><h2>How the idea got here.</h2></div><p className="section-intro">A chronology of dated evidence. Undated sources are left out.</p>
      {report.timeline.length ? <ol className="timeline">{report.timeline.map((event) => <li key={event.id}><time dateTime={event.precision === "year" ? event.date.slice(0, 4) : event.date.slice(0, 10)}>{event.precision === "year" ? event.date.slice(0, 4) : event.date.slice(0, 10)}</time><div><span className="source-meta">{event.type.toLowerCase()}</span><h3>{event.title}</h3>{cite(event.evidenceIds)}</div></li>)}</ol> : <Empty>No reliable dates were available to reconstruct a history.</Empty>}
    </section>
    <section hidden={activeSection !== "opportunities"} id="opportunities" className="report-section"><div className="report-section-heading"><span>06</span><h2>Where to look closer.</h2></div><p className="section-intro">Lower coverage can suggest a research question. It is never guaranteed white space.</p>
      <details className="coverage-help"><summary>How to read these counts</summary><p>Counts include sources that matched this concept and passed the relevance check. Patent results that missed the filter are still listed in Patents for manual review.</p></details>
      <div className="coverage-cards">{report.coverage.map((row) => <article className="coverage-card" key={row.concept}><header><h3>{row.concept}</h3><span className={`status-chip coverage-${row.level}`}>{row.level} coverage</span></header><div className="coverage-metrics"><div><strong>{row.patents}</strong><span>Patents</span></div><div><strong>{row.research}</strong><span>Research</span></div><div><strong>{row.products}</strong><span>Products</span></div><div><strong>{row.web}</strong><span>Web / market</span></div></div><div className="coverage-card-footer"><span>{row.total} relevant sources</span>{row.evidenceIds.length ? <details><summary>View evidence</summary>{cite(row.evidenceIds)}</details> : <span>No matched sources yet</span>}</div></article>)}</div>
      <div className="gap-list">{report.gaps.map((gap) => <article key={gap.id}><span className="confidence">{gap.confidence} confidence · potential area to investigate</span><h3>{gap.title}<IconArrowUpRight size={22} aria-hidden="true" /></h3><p>{gap.body}</p><p className="gap-rationale">{gap.rationale}</p>{cite(gap.evidenceIds)}</article>)}</div>
      {!report.gaps.length && <Empty>{report.aiEnrichment === false ? "Opportunity interpretation was not run. Review the source evidence to identify questions worth investigating." : "No verified opportunity suggestions are available. Missing suggestions do not establish novelty or the absence of opportunities."}</Empty>}
      {Boolean(report.relatedSearches?.length) && <><h3>Related searches returned by Google</h3><p className="muted">Suggestions for further research, not evidence of demand.</p><ul>{report.relatedSearches?.map((entry) => <li key={entry.query}><SourceLink url={"https://www.google.com/search?q=" + encodeURIComponent(entry.query)}>{entry.query}</SourceLink></li>)}</ul></>}
    </section>
    <section hidden={activeSection !== "search-trace"} id="search-trace" className="report-section"><div className="report-section-heading"><span>07</span><h2>Follow the search.</h2></div><p className="section-intro">Every search, its purpose, and the evidence it contributed.</p>
      <div className="table-scroll"><table className="trace-table"><thead><tr><th>Engine / purpose</th><th>Query / links</th><th>Received</th><th>Retained</th><th>Duration</th><th>Status</th></tr></thead><tbody>{report.trace.map((run) => {
        const officialUrl = run.officialUrl ?? officialSearchUrl(run.engine, run.query);
        return <tr key={run.id}><td><strong>{run.engine}</strong><small>{run.purpose}</small></td><td><span>{run.query}</span><div className="trace-links"><SourceLink url={officialUrl}>Open on {officialSearchLabel(run.engine)}</SourceLink></div><small>{run.serpApiSearchId ?? "No search ID"} · {run.attempts} remote attempt{run.attempts === 1 ? "" : "s"}</small>{run.error && <small>{run.error}</small>}</td><td>{run.resultCount}</td><td>{run.retainedCount}</td><td>{(run.durationMs / 1000).toFixed(1)}s</td><td><span className="status-chip">{run.status.toLowerCase()}</span></td></tr>;
      })}</tbody></table></div>
    </section>
    <section hidden={activeSection !== "sources"} id="sources" className="report-section"><div className="report-section-heading"><span>08</span><h2>The evidence is yours to inspect.</h2></div><EvidenceBrowser evidence={report.evidence} onSelect={setSelectedId} /></section>
    <EvidenceDialog item={report.evidence.find((item) => item.id === selectedId)} onClose={() => setSelectedId(undefined)} />
  </div>;
}

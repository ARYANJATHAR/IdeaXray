"use client";
import { useEffect, useRef, useState } from "react";
import { IconExternalLink, IconX } from "@tabler/icons-react";
import type { EvidenceItem, EvidenceType } from "@/src/lib/contracts";
import { safeUrl } from "@/src/lib/urls";
export function SourceLink({ url, children = "Open source" }: { url?: string; children?: React.ReactNode }) {
  const safe = safeUrl(url);
  return safe ? <a className="source-link" href={safe} target="_blank" rel="noopener noreferrer">{children}<IconExternalLink size={14} aria-hidden="true" /></a> : <span className="muted">Source link unavailable</span>;
}
export function Citations({ ids, evidence, onSelect }: { ids: string[]; evidence: EvidenceItem[]; onSelect: (id: string) => void }) {
  return <span className="citations">{[...new Set(ids)].map((id) => {
    const index = evidence.findIndex((item) => item.id === id);
    return index < 0 ? null : <button type="button" key={id} onClick={() => onSelect(id)} title={evidence[index].title} aria-label={"View source " + (index + 1) + ": " + evidence[index].title}>[{index + 1}]</button>;
  })}</span>;
}
export function metadataText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Unavailable";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export function EvidenceDialog({ item, onClose }: { item: EvidenceItem | undefined; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (item && ref.current && !ref.current.open) ref.current.showModal(); if (!item) ref.current?.close(); }, [item]);
  return <dialog ref={ref} className="evidence-dialog" aria-labelledby="evidence-dialog-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    {item && <div className="evidence-dialog-body">
      <button type="button" className="icon-button dialog-close" aria-label="Close source" onClick={onClose}><IconX size={22} /></button>
      <p className="eyebrow">{item.type.toLowerCase()} evidence</p><h2 id="evidence-dialog-title">{item.title}</h2>
      <p className="muted">{item.source ?? "Source not specified"}{item.sourceDate ? " · " + (item.metadata.datePrecision === "year" ? item.sourceDate.slice(0, 4) : item.sourceDate.slice(0, 10)) : ""}</p>
      <p className="evidence-snippet">{item.snippet ?? "No snippet was supplied by the search engine."}</p>
      <SourceLink url={item.url} />
      <dl className="evidence-details">
        <dt>Relevance heuristic</dt><dd>{item.relevanceScore}/100</dd><dt>Included in metrics</dt><dd>{item.retained ? "Yes" : item.duplicateOf ? "No, duplicate source" : "No, below threshold or unranked"}</dd>
        <dt>Engine</dt><dd>{item.engine}</dd><dt>Query</dt><dd>{item.query}</dd><dt>Search ID</dt><dd>{item.serpApiSearchId ?? "Unavailable"}</dd>
        <dt>Evidence ID</dt><dd>{item.id}</dd>
      </dl>
      <details><summary>Original source details</summary><dl className="evidence-details">{Object.entries(item.metadata).filter(([key, value]) => value !== undefined && value !== null && key !== "points").map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{metadataText(value)}</dd></div>)}</dl></details>
    </div>}
  </dialog>;
}
const filters: { label: string; type: EvidenceType | "ALL" }[] = [{ label: "All", type: "ALL" }, { label: "Patents", type: "PATENT" }, { label: "Research", type: "RESEARCH" }, { label: "Products", type: "PRODUCT" }, { label: "Companies", type: "COMPANY" }, { label: "News", type: "NEWS" }, { label: "Web", type: "WEB" }, { label: "Trends", type: "TREND" }];
export function EvidenceBrowser({ evidence, onSelect }: { evidence: EvidenceItem[]; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<EvidenceType | "ALL">("ALL"); const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState(false); const [limit, setLimit] = useState(24);
  const items = evidence.filter((item) => (excluded || item.retained) && (filter === "ALL" || item.type === filter) && (item.title + " " + (item.snippet ?? "")).toLowerCase().includes(query.toLowerCase()));
  return <div className="evidence-browser">
    <div className="filter-row" aria-label="Filter source type">{filters.map((option) => <button className="filter-chip" type="button" aria-pressed={filter === option.type} key={option.type} onClick={() => { setFilter(option.type); setLimit(24); }}>{option.label}</button>)}</div>
    <div className="source-search"><label htmlFor="source-query" className="sr-only">Search sources</label><input id="source-query" type="search" value={query} placeholder="Search within the evidence…" onChange={(event) => { setQuery(event.target.value); setLimit(24); }} /><label className="checkbox-label"><input type="checkbox" checked={excluded} onChange={(event) => { setExcluded(event.target.checked); setLimit(24); }} />Include excluded and duplicate results</label></div>
    <p className="muted">{items.length} source{items.length === 1 ? "" : "s"} match your filters.</p>
    <div className="source-list">{items.slice(0, limit).map((item) => <article key={item.id}>
      <div className="source-meta"><span>{item.type.toLowerCase()}</span><span>{item.relevanceScore}/100 relevance</span>{!item.retained && <span>Excluded from metrics</span>}</div>
      <button type="button" className="source-title" onClick={() => onSelect(item.id)}>{item.title}</button><p>{item.snippet?.slice(0, 260) ?? "No snippet available."}</p><SourceLink url={item.url}>{item.source ?? "Open original"}</SourceLink>
    </article>)}</div>
    {!items.length && <p className="empty-state">No sources match these filters. Try another category or include excluded results.</p>}
    {items.length > limit && <button className="button button-secondary" onClick={() => setLimit((value) => value + 24)}>Show more sources</button>}
  </div>;
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import type { AnalysisSnapshot } from "@/src/lib/contracts";
import { progressStages, stageLabels, terminalStatuses } from "@/src/lib/contracts";
import { ReportView } from "./report-view";

export function AnalysisController({ id, initialAnalysis = null }: { id: string; initialAnalysis?: AnalysisSnapshot | null }) {
  const [analysis, setAnalysis] = useState<AnalysisSnapshot | null>(initialAnalysis);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController(); let stream: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined; let closed = false; let fetching = false;
    function schedule() { if (!closed && !timer) timer = setTimeout(() => { timer = undefined; void refresh(); }, 6000); }
    async function refresh() {
      if (fetching || closed) return; fetching = true;
      try {
        const response = await fetch("/api/analyses/" + encodeURIComponent(id), { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
        const body = await response.json();
        if (!response.ok) { if (closed) return; setError(body.error ?? "This analysis could not be loaded."); stream?.close(); stream = undefined; if (response.status >= 500) schedule(); return; }
        if (closed) return;
        const snapshot = body as AnalysisSnapshot; setAnalysis(snapshot); setError("");
        if (terminalStatuses.includes(snapshot.status)) { stream?.close(); if (timer) clearTimeout(timer); timer = undefined; setConnection(""); return; }
        if (!stream && typeof EventSource !== "undefined") {
          stream = new EventSource("/api/analyses/" + encodeURIComponent(id) + "/events");
          stream.addEventListener("progress", (event) => {
            if (closed) return;
            try {
              const progress = JSON.parse((event as MessageEvent).data) as AnalysisSnapshot;
              if (terminalStatuses.includes(progress.status)) { stream?.close(); schedule(); void refresh(); }
              else { setAnalysis(progress); setConnection(""); }
            } catch { schedule(); }
          });
          stream.addEventListener("reconnect", () => { setConnection("Reconnecting to live progress…"); schedule(); });
          stream.onerror = () => { if (!closed) { setConnection("Reconnecting. Research continues in the background."); schedule(); } };
          stream.onopen = () => { if (!closed) setConnection(""); };
        }
        schedule();
      } catch { if (!closed) { setError("Could not reach the server. Your research may still be running."); schedule(); } }
      finally { fetching = false; }
    }
    void refresh();
    return () => { closed = true; abort.abort(); stream?.close(); if (timer) clearTimeout(timer); };
  }, [id, revision]);

  const current = analysis ? progressStages.indexOf(analysis.currentStage) : -1;
  const visibleStages = progressStages;

  return <div className="analysis-controller">
    <Link href="/analyze" className="back-link"><IconArrowLeft size={17} aria-hidden="true" />Research another idea</Link>
    {error && <div className="notice connection-error" role="alert"><p>{error}</p><button className="button button-secondary button-small" onClick={() => setRevision((value) => value + 1)}>Reload report</button></div>}
    {!analysis && !error && <div className="loading-page" aria-busy="true"><p role="status">Opening your analysis…</p><div className="loading-line" /><div className="loading-panel" /></div>}
    {analysis && !terminalStatuses.includes(analysis.status) && <section className="progress-view card progress-card" aria-labelledby="progress-title">
      <p className="eyebrow">Research in progress</p><h1 id="progress-title">{analysis.normalizedTitle ?? "Putting your idea in perspective."}</h1>
      <p className="original-idea">{analysis.originalIdea}</p>
      <div className="progress-current"><span role="status">{analysis.message}</span><strong>{analysis.progress}%</strong></div>
      <progress value={analysis.progress} max={100} aria-label="Research progress" />
      <p className="muted">Progress shows completed research stages, not time remaining.</p>
      <ol className="stage-list">{visibleStages.map((stage) => {
        const index = progressStages.indexOf(stage); const done = analysis.completedStages.includes(stage);
        return <li key={stage} className={done ? "stage-done" : index === current ? "stage-current" : ""} aria-current={index === current ? "step" : undefined}>
          <span>{done ? <IconCheck size={15} aria-label="Stage passed" /> : String(index + 1).padStart(2, "0")}</span>{stageLabels[stage]}
        </li>;
      })}</ol>
      <p className="muted">{connection || (analysis.status === "QUEUED" ? "Starting research. You can leave this page and return to the same link in this browser." : "Searches run in the background. Refresh safely without losing progress.")}</p>
    </section>}
    {analysis?.status === "FAILED" && <section className="failed-view card"><p className="eyebrow">Research interrupted</p><h1>We couldn’t finish this investigation.</h1><p>{analysis.error ?? "One of the required services could not complete the request."}</p><p className="original-idea">{analysis.originalIdea}</p><Link className="button button-secondary" href={"/analyze?" + new URLSearchParams({ idea: analysis.originalIdea, region: analysis.region }).toString()}>Revise your idea</Link>{analysis.warnings.map((warning) => <p className="muted" key={warning}>{warning}</p>)}</section>}
    {analysis?.report && terminalStatuses.includes(analysis.status) && <ReportView analysis={analysis} report={analysis.report} />}
  </div>;
}

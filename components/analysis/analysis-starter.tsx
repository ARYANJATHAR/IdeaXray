"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisInput } from "@/src/lib/analysis-input";

export function AnalysisStarter({ input }: { input: AnalysisInput }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const response = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Research could not start. Try again.");
        router.replace(`/analyze?id=${encodeURIComponent(body.analysisId)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not connect to the research service.");
      }
    })();
  }, [input, router]);

  if (error) {
    return (
      <section className="failed-view card">
        <p className="eyebrow">Research interrupted</p>
        <h1>We couldn&apos;t start this investigation.</h1>
        <p>{error}</p>
        <p className="original-idea">{input.idea}</p>
      </section>
    );
  }

  return (
    <div className="loading-page" aria-busy="true">
      <p role="status">Starting your research…</p>
      <div className="loading-line" />
      <div className="loading-panel" />
    </div>
  );
}

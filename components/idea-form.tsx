"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight, IconArrowUpRight, IconCopy, IconFocus2, IconLock } from "@tabler/icons-react";
import {
  analysisInputSchema, exampleIdeas, IDEA_MAX_LENGTH, researchRegions,
  type AnalysisInput,
} from "@/src/lib/analysis-input";

type IdeaFormProps = {
  mode: "landing" | "analysis";
  initialIdea?: string;
  initialRegion?: AnalysisInput["region"];
};

export function IdeaForm({ mode, initialIdea = "", initialRegion = "worldwide" }: IdeaFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [idea, setIdea] = useState(initialIdea);
  const [region, setRegion] = useState(initialRegion);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const isLanding = mode === "landing";

  function validate() {
    const result = analysisInputSchema.safeParse({ idea, region });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check your idea.");
      inputRef.current?.focus();
      return null;
    }
    setError("");
    return result.data;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || pending) return;
    const input = validate();
    if (!input) return;
    if (isLanding) {
      startTransition(() => router.push("/analyze?" + new URLSearchParams({ idea: input.idea }).toString()));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Research could not start. Try again.");
      startTransition(() => router.push(`/analyze?id=${encodeURIComponent(body.analysisId)}`));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not connect to the research service."); }
    finally { setSubmitting(false); }
  }

  async function copyBrief() {
    const input = validate();
    if (!input) return;
    const regionLabel = researchRegions.find((item) => item.value === input.region)?.label;
    try {
      await navigator.clipboard.writeText(`${input.idea}\n\nResearch region: ${regionLabel}`);
      setCopyStatus("Brief copied.");
    } catch {
      setCopyStatus("Copy is unavailable. You can select and copy your idea directly.");
    }
  }

  return (
    <div className={`idea-form-wrap ${isLanding ? "landing-form" : "analysis-form"}`}>
      <form onSubmit={submit} noValidate>
        <div className="idea-input-panel">
          <div className="input-heading flex items-center justify-between gap-4">
            <label htmlFor="idea"><IconFocus2 size={19} stroke={1.7} aria-hidden="true" />{isLanding ? "What are you thinking of building?" : "Describe your idea"}</label>
            <span className="character-count">{idea.length.toLocaleString()} / 2,000</span>
          </div>
          <div className="textarea-field">
            <textarea
              ref={inputRef} id="idea" name="idea" value={idea}
              onChange={(event) => { setIdea(event.target.value); setError(""); setCopyStatus(""); }}
              placeholder="An idea, a what-if, a problem you want to solve…"
              maxLength={IDEA_MAX_LENGTH} rows={isLanding ? 3 : 5}
              aria-invalid={Boolean(error)} aria-describedby={`idea-help${error ? " idea-error" : ""}`}
            />
          </div>
          <div className="input-bottom">
            <p id="idea-help">{isLanding ? "Start with a few sentences. Follow your curiosity." : "Include the problem, who it helps, and how it works."}</p>
            {isLanding && <button className="button button-primary landing-submit" type="submit" disabled={submitting || pending}>
              {pending ? "Opening research brief…" : "Continue"}<IconArrowRight size={19} aria-hidden="true" />
            </button>}
          </div>
        </div>
        {error && <p id="idea-error" className="form-error" role="alert">{error}</p>}
        {!isLanding && <>
          <div className="settings-grid grid gap-6 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="region">Research region</label>
              <select id="region" name="region" value={region} onChange={(event) => { setRegion(event.target.value as AnalysisInput["region"]); setCopyStatus(""); }}>
                {researchRegions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <p>Where to focus your research.</p>
            </div>
          </div>
          <p className="privacy-note"><IconLock size={16} aria-hidden="true" />Starting research sends search terms from your idea to SerpApi. If enabled, optional AI interpretation also sends your brief and selected source excerpts to the configured AI provider. Avoid including confidential information.</p>
          <div className="analysis-actions flex flex-wrap items-center gap-4">
            <button type="submit" className="button button-primary" disabled={submitting || pending} aria-describedby="research-status">{submitting || pending ? "Starting research…" : "X-Ray My Idea"}<IconArrowRight size={18} aria-hidden="true" /></button>
            <button type="button" className="button button-secondary" onClick={copyBrief}><IconCopy size={17} aria-hidden="true" />Copy brief</button>
            <span className="copy-status" role="status">{copyStatus}</span>
          </div>
          <p id="research-status" className="research-status">Research can take a few minutes. Slow or unavailable AI services may result in a partial report with the evidence already collected.</p>
        </>}
      </form>
      <div className="example-ideas">
        <p>{isLanding ? "A little inspiration" : "Or start with an example"}</p>
        <div className="flex flex-wrap gap-2">
          {exampleIdeas.map((example) => <button key={example.label} className="example-chip" type="button" onClick={() => {
            setIdea(example.idea); setError(""); setCopyStatus(""); inputRef.current?.focus();
          }}>{example.label}<IconArrowUpRight size={14} aria-hidden="true" /></button>)}
        </div>
      </div>
    </div>
  );
}

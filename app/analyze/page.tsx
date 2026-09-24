import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft, IconArrowRight, IconFocus2 } from "@tabler/icons-react";
import { IdeaForm } from "@/components/idea-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IDEA_MAX_LENGTH, analysisInputSchema } from "@/src/lib/analysis-input";
import { AnalysisController } from "@/components/analysis/analysis-controller";
import { readAnalysis } from "@/src/server/analysis/read";

export const metadata: Metadata = { title: "Explore your idea", robots: { index: false, follow: false } };
type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const incomingIdea = first(params.idea) ?? "";
  const initialIdea = incomingIdea.slice(0, IDEA_MAX_LENGTH);
  const region = analysisInputSchema.shape.region.safeParse(first(params.region));
  const id = first(params.id);
  if (id) {
    const initialAnalysis = await readAnalysis(id).catch(() => null);
    return <><SiteHeader analysis /><main id="main-content" className="analysis-main page-width"><AnalysisController key={id} id={id} initialAnalysis={initialAnalysis} /></main><SiteFooter /></>;
  }

  return (
    <>
      <SiteHeader analysis />
      <main id="main-content" className="analysis-main page-width">
        <Link href="/" className="back-link"><IconArrowLeft size={17} aria-hidden="true" />Back to home</Link>
        <div className="analysis-heading"><p className="eyebrow">Follow the evidence</p><h1>Give your idea some context.</h1><p>Start with what you have in mind. A little detail goes a long way.</p></div>
        <div className="analysis-layout grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Your research brief" className="research-brief">
            {incomingIdea.length > IDEA_MAX_LENGTH && <p className="notice" role="status">This idea was longer than 2,000 characters and has been shortened. Review it before continuing.</p>}
            <IdeaForm key={`${initialIdea}-${region.data}`} mode="analysis" initialIdea={initialIdea} initialRegion={region.success ? region.data : "worldwide"} />
          </section>
          <aside className="research-preview" aria-labelledby="preview-title">
            <span className="preview-symbol"><IconFocus2 size={28} stroke={1.5} aria-hidden="true" /></span>
            <h2 id="preview-title">One idea.<br />A wider landscape.</h2>
            <p>Your research brings together:</p>
            <ul>
              <li>Related patents and research</li><li>Existing products and companies</li><li>Evidence-backed opportunity areas</li><li>A full search trace</li>
            </ul>
            <div className="preview-footnote"><IconArrowRight size={18} aria-hidden="true" /><p>Follow each finding back to the evidence behind it.</p></div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

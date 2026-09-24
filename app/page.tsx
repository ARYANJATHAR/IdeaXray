import Image from "next/image";
import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";
import { IdeaForm } from "@/components/idea-form";
import { InvestigationTopics } from "@/components/investigation-topics";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <div className="landing-page">
      <SiteHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <Image className="hero-photo" src="/images/forest-canopy-ai.webp" alt="" fill priority sizes="100vw" />
          <div className="hero-scrim" />
          <div className="hero-content page-width">
            <p className="hero-eyebrow">A clearer view of what comes next</p>
            <h1 id="hero-title">Every idea has a history.<br /><span>Discover yours.</span></h1>
            <p className="hero-description">Explore the inventions, research, and attempts that came before. Find a more informed way forward.</p>
            <IdeaForm mode="landing" />
          </div>
        </section>
        <InvestigationTopics />
        <section className="evidence-note page-width" aria-labelledby="evidence-title">
          <div className="evidence-note-inner grid gap-6 md:grid-cols-2">
            <h2 id="evidence-title">More context.<br />Better questions.</h2>
            <div><p>IdeaXray connects findings to their sources, traces earlier attempts, and makes uncertainty visible. Explore the evidence behind your idea.</p><p>Less coverage is a reason to investigate, never a guarantee of novelty or success.</p><Link href="/analyze" className="button button-primary evidence-cta">Explore your idea<IconArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

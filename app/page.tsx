import Image from "next/image";
import { IconArrowDownRight } from "@tabler/icons-react";
import { IdeaForm } from "@/components/idea-form";
import { InvestigationTopics } from "@/components/investigation-topics";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <Image className="hero-photo" src="/images/forest-canopy.jpg" alt="" fill priority sizes="100vw" />
          <div className="hero-scrim" />
          <div className="hero-content page-width">
            <h1 id="hero-title">See what happened to your idea<br className="desktop-break" /> before you build it.</h1>
            <p className="hero-description">Explore the inventions, research, and attempts that came before. Find a more informed way forward.</p>
            <IdeaForm mode="landing" />
          </div>
        </section>
        <div className="perspective-note page-width flex items-center justify-between gap-6">
          <p>A starting point for your next <span>“what if?”</span></p>
          <span className="flex items-center gap-2">Built for curious minds<IconArrowDownRight size={20} aria-hidden="true" /></span>
        </div>
        <InvestigationTopics />
        <section className="evidence-note page-width" aria-labelledby="evidence-title">
          <div className="evidence-note-inner grid gap-6 md:grid-cols-2">
            <h2 id="evidence-title">More context.<br />Better questions.</h2>
            <div><p>IdeaXray connects findings to their sources, traces earlier attempts, and makes uncertainty visible. Explore the evidence behind your idea.</p><p>Less coverage is a reason to investigate, never a guarantee of novelty or success.</p></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

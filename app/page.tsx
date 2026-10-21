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
        <section className="demo-section page-width" id="demo" aria-labelledby="demo-title">
          <div className="demo-heading">
            <p className="eyebrow">A look inside</p>
            <h2 id="demo-title">See IdeaXray in action.</h2>
            <p>Follow an idea from the first question to a report grounded in sources.</p>
          </div>
          <video className="demo-video" controls playsInline preload="none" poster="/images/ideaxray-demo.jpg" aria-label="IdeaXray product demo">
            <source src="/videos/ideaxray-demo.mp4" type="video/mp4" />
            Your browser does not support embedded video. <a href="/videos/ideaxray-demo.mp4">Watch the IdeaXray demo.</a>
          </video>
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

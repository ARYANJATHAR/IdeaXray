import Link from "next/link";
import { IconArrowUpRight, IconFocus2 } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ analysis = false }: { analysis?: boolean }) {
  return (
    <header className="site-header page-width flex items-center justify-between gap-4">
      <Link href="/" className="wordmark" aria-label="IdeaXray home">
        <span className="brand-symbol"><IconFocus2 size={25} stroke={1.7} aria-hidden="true" /></span>
        Idea<span className="wordmark-light">Xray</span>
      </Link>
      <nav aria-label="Main navigation" className="header-actions flex items-center gap-3 sm:gap-5">
        <Link className="nav-link" href="/#investigation">What we investigate</Link>
        <ThemeToggle />
        <Link className="button button-primary button-small" href={analysis ? "/" : "/analyze"}>
          {analysis ? "New idea" : "Explore your idea"}<IconArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}

import Link from "next/link";

export default function NotFound() {
  return <main id="main-content" className="message-page page-width"><p className="eyebrow">Page not found</p><h1>Let’s find a new starting point.</h1><p>The page you’re looking for isn’t here.</p><Link className="button button-primary" href="/">Back to IdeaXray</Link></main>;
}

"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="message-page page-width"><h1>Something interrupted the page.</h1><p>Please try again. Your research has not been started.</p><button className="button button-primary" onClick={reset}>Try again</button></main>;
}

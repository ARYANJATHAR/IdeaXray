export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return; return url.href; } catch { return; }
}
export function canonicalUrl(value: unknown): string | undefined {
  const safe = safeUrl(value); if (!safe) return;
  const url = new URL(safe); url.hash = ""; url.hostname = url.hostname.replace(/^www\./, "");
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid|ref$|source$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort(); return url.toString().replace(/\/$/, "");
}
export function normalizedTitle(value: string) { return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

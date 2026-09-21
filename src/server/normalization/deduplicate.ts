import type { EvidenceItem } from "@/src/lib/contracts";
import { canonicalUrl, normalizedTitle } from "@/src/lib/urls";
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function deduplicate(items: EvidenceItem[], vectors: Map<string, number[]> = new Map()) {
  const keys = new Map<string, string>();
  const canonical: EvidenceItem[] = [];
  for (const item of [...items].sort((a, b) => b.relevanceScore - a.relevanceScore)) {
    item.duplicateOf = undefined;
    const publication = typeof item.metadata.publicationNumber === "string" ? item.metadata.publicationNumber.replace(/[^a-z0-9]/gi, "").toUpperCase() : "";
    const url = canonicalUrl(item.url);
    const title = normalizedTitle(item.title);
    const candidates = [url ? "url:" + url : "", publication ? "patent:" + publication : "", title ? item.type + ":" + title : ""].filter(Boolean);
    let duplicate = candidates.map((key) => keys.get(key)).find(Boolean);
    if (!duplicate && vectors.has(item.id)) duplicate = canonical.find((other) => {
      // Do not semantically collapse different patent publication numbers.
      if (other.type !== item.type || (item.type === "PATENT" && publication && other.metadata.publicationNumber !== item.metadata.publicationNumber)) return false;
      return vectors.has(other.id) && cosine(vectors.get(item.id)!, vectors.get(other.id)!) >= 0.97;
    })?.id;
    if (duplicate) { item.duplicateOf = duplicate; item.retained = false; }
    else { canonical.push(item); for (const key of candidates) keys.set(key, item.id); }
  }
  return items;
}
export function entityKey(name: string) { return normalizedTitle(name).replace(/\s+(inc|incorporated|llc|ltd|limited|corp|corporation)$/, ""); }

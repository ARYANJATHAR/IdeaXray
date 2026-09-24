import type { IdeaDecomposition } from "@/src/lib/contracts";

// Extract search vocabulary only; never invent a problem or product specification.
export function researchBrief(input: string): IdeaDecomposition {
  const stop = new Set("a an the and or for with that this from using uses use should would could have has without into such as it be to of in on is are i want make build create people users".split(" "));
  const words = [...new Set((input.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? []).filter((word) => !stop.has(word)))];
  const query = words.slice(0, 10).join(" ") || input.slice(0, 120);
  return { title: input.split(/[.!?\n]/)[0].slice(0, 120), problem: "Not separately interpreted. See the original brief.", solution: input, targetUsers: [], technologies: [], mechanisms: [], synonyms: [], concepts: words.slice(0, 8), commercialTerms: [query], researchTerms: [query] };
}
export function isPhysicalProduct(input: string) {
  return /\b(device|sensor|cane|bottle|backpack|robot|wearable|hardware|battery|charger|machine|helmet|appliance|shoe|clothing|furniture|watch|drone|filter|gadget)s?\b/i.test(input);
}

import type { AnalysisInput } from "@/src/lib/analysis-input";
import type { IdeaDecomposition, SearchPlanItem } from "@/src/lib/contracts";
import { languageProvider } from "../ai/provider";
import { querySchema } from "../ai/schemas";
import { google } from "../serpapi/google";
import { patents } from "../serpapi/patents";
import { scholar } from "../serpapi/scholar";
import { news } from "../serpapi/news";
import { trends } from "../serpapi/trends";

export function locale(region: string): Record<string, string> {
  return region === "india" ? { gl: "in" } : region === "us" ? { gl: "us" } : {};
}

export async function planQueries(idea: IdeaDecomposition, input: AnalysisInput): Promise<SearchPlanItem[]> {
  const terms = await languageProvider.structured(
    "Generate one focused query each for patents, academic research, and web/market discovery, plus one news query and up to three broad commercial terms for Google Trends. Keep queries short and engine-appropriate. Europe should be expressed in market query wording; do not invent a Google country code for Europe.",
    { idea, region: input.region },
    querySchema,
  );
  const marketLocale = locale(input.region);
  const regional = (query: string) => input.region === "europe" && !/europe|european/i.test(query) ? query + " Europe" : query;
  const patent = terms.patents[0] ?? idea.concepts[0] ?? idea.title;
  const paper = terms.scholar[0] ?? idea.researchTerms[0] ?? idea.title;
  const web = terms.web[0] ?? idea.commercialTerms[0] ?? idea.title;
  const newsQuery = regional(terms.news || idea.commercialTerms[0] || idea.title);
  const trendTerms = terms.trends.length ? terms.trends.slice(0, 3) : idea.commercialTerms.slice(0, 3);
  return [
    patents(patent),
    scholar(paper),
    google(regional(web), "Discover related products and companies", marketLocale),
    news(newsQuery, marketLocale),
    trends(trendTerms.length ? trendTerms : [idea.title], input.region),
  ];
}

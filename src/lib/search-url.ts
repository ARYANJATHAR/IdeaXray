import type { Engine } from "./contracts";

const engineLabels: Record<Engine, string> = {
  google: "Google",
  google_patents: "Google Patents",
  google_patents_details: "Google Patents",
  google_scholar: "Google Scholar",
  google_news: "Google News",
  google_shopping: "Google Shopping",
  google_trends: "Google Trends",
};

export function officialSearchLabel(engine: Engine) {
  return engineLabels[engine] ?? "Google";
}

export function officialSearchUrl(engine: Engine, query: string, params: Record<string, string | number> = {}) {
  const encodedQuery = encodeURIComponent(query);
  switch (engine) {
    case "google_patents":
      return `https://patents.google.com/?q=${encodedQuery}`;
    case "google_patents_details": {
      const patentId = String(params.patent_id ?? query).replace(/^\/+/, "");
      const path = patentId.startsWith("patent/") ? patentId : `patent/${patentId}`;
      return `https://patents.google.com/${path}`;
    }
    case "google_scholar":
      return `https://scholar.google.com/scholar?q=${encodedQuery}`;
    case "google_news": {
      const url = new URL("https://news.google.com/search");
      url.searchParams.set("q", query);
      url.searchParams.set("hl", String(params.hl ?? "en"));
      return url.toString();
    }
    case "google_shopping": {
      const url = new URL("https://www.google.com/search");
      url.searchParams.set("q", query);
      url.searchParams.set("tbm", "shop");
      if (params.gl) url.searchParams.set("gl", String(params.gl));
      return url.toString();
    }
    case "google_trends": {
      const url = new URL("https://trends.google.com/trends/explore");
      url.searchParams.set("date", String(params.date ?? "today 5-y"));
      url.searchParams.set("q", query);
      if (params.geo) url.searchParams.set("geo", String(params.geo));
      return url.toString();
    }
    case "google":
    default: {
      const url = new URL("https://www.google.com/search");
      url.searchParams.set("q", query);
      if (params.gl) url.searchParams.set("gl", String(params.gl));
      if (params.hl) url.searchParams.set("hl", String(params.hl));
      return url.toString();
    }
  }
}

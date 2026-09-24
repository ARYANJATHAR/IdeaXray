import { expect, it } from "vitest";
import { normalize } from "@/src/server/serpapi/normalize";
import { planQueries } from "@/src/server/analysis/planner";
import { researchBrief } from "@/src/server/analysis/brief";
import { solutionsState } from "@/src/lib/solutions";
import { evidence, report, searches } from "./fixtures";

it("parses Google product blocks and knowledge panels without treating suggestions as evidence", () => {
  const rows = normalize({
    organic_results: [{ title: "Official device", link: "https://example.com/device" }],
    inline_shopping_results: [{ title: "Listed device", product_link: "https://example.com/product", price: "₹500", source: "Seller" }],
    knowledge_graph: { title: "Device maker", description: "Source description", website: "https://example.com" },
    related_searches: [{ query: "more devices" }],
  }, { engine: "google", query: "device", purpose: "Discovery", params: {} }, searches()[2]);
  expect(rows).toHaveLength(3);
  expect(rows[1]).toMatchObject({ type: "PRODUCT", url: "https://example.com/product", metadata: { price: "₹500" } });
  expect(rows[2]).toMatchObject({ type: "WEB", metadata: { resultSection: "knowledge_graph" } });
});

it("routes physical products to Shopping with the chosen region, but not software-only ideas", async () => {
  const idea = "A white cane with ultrasonic sensors";
  const physical = await planQueries(researchBrief(idea), { idea, region: "india" });
  expect(physical).toHaveLength(6);
  expect(physical.find((item) => item.engine === "google_shopping")?.params.gl).toBe("in");
  const software = "An app for organising team meetings";
  expect((await planQueries(researchBrief(software), { idea: software, region: "worldwide" })).some((item) => item.engine === "google_shopping")).toBe(false);
});

it("shows product and web evidence directly without reporting a classification failure", () => {
  const items = [evidence({ type: "PRODUCT" }), evidence({ type: "WEB" }), evidence({ retained: false })];
  const value = { ...report(items), sourceFirst: true, classificationComplete: false };
  expect(solutionsState(value)).toMatchObject({ incomplete: false, candidates: [items[0], items[1]] });
  expect(value.entities).toEqual([]);
});

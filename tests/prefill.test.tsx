import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AnalyzePage from "@/app/analyze/page";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

it("an idea URL opens an editable form without starting research", async () => {
  const page = await AnalyzePage({ searchParams: Promise.resolve({ idea: "A camera backpack that follows people", region: "india" }) });
  const html = renderToStaticMarkup(page);
  expect(html).toContain("<form");
  expect(html).toContain("A camera backpack that follows people");
  expect(html).toContain('value="india" selected=""');
  expect(html).not.toContain("Starting your research");
});

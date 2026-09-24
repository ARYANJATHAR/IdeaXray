// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IdeaForm } from "@/components/idea-form";
import { AnalysisController } from "@/components/analysis/analysis-controller";
import { report, snapshot } from "./fixtures";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/analysis/report-view", () => ({ ReportView: () => <div>Finished report</div> }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); push.mockClear(); });

it("landing preserves the idea without starting paid research", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const idea = "A camera backpack that follows people";
  render(<IdeaForm mode="landing" initialIdea={idea} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(push).toHaveBeenCalledWith("/analyze?" + new URLSearchParams({ idea }));
});

it("research starts only after the selected region is submitted", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ analysisId: "test-run" }) });
  vi.stubGlobal("fetch", fetch);
  const view = render(<IdeaForm mode="analysis" initialIdea="A camera backpack that follows people" />);
  fireEvent.change(screen.getByLabelText("Research region"), { target: { value: "india" } });
  await act(async () => { fireEvent.submit(view.container.querySelector("form")!); });
  expect(JSON.parse(fetch.mock.calls[0][1].body).region).toBe("india");
  expect(push).toHaveBeenCalledWith("/analyze?id=test-run");
});

it("shows initial progress immediately and polls while a live stream is silent", async () => {
  vi.useFakeTimers();
  const initial = { ...snapshot(report()), status: "RUNNING" as const, currentStage: "CLASSIFYING_EVIDENCE" as const, progress: 62, message: "Organising sources", report: null };
  const final = snapshot(report());
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => initial }).mockResolvedValue({ ok: true, json: async () => final });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
  await act(async () => { render(<AnalysisController id={initial.id} initialAnalysis={initial} />); });
  expect(screen.queryByText("Opening your analysis…")).toBeNull();
  expect(screen.getByText("Organising sources")).toBeDefined();
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Finished report")).toBeDefined();
});

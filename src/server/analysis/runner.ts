import "server-only";
import { runAnalysis } from "./pipeline";
import { logEvent } from "../errors";

const running = new Set<string>();

export function startAnalysis(analysisId: string) {
  if (running.has(analysisId)) return;
  running.add(analysisId);
  void runAnalysis(analysisId).catch(() => undefined).finally(() => {
    running.delete(analysisId);
    logEvent("analysis_task_finished", { analysisId });
  });
}

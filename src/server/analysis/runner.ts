import "server-only";
import { runAnalysis } from "./pipeline";
import { db } from "../db/client";
import { getServerEnv } from "../env";
import { AppError, logEvent } from "../errors";
import { abortable, failAnalysis, jobContext, LEASE_MS } from "./lifecycle";

export async function startAnalysis(analysisId: string) {
  const abort = new AbortController();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const claimed = await db().analysis.updateMany({
      where: { id: analysisId, status: "QUEUED", leaseExpiresAt: { gt: new Date() } },
      data: { status: "RUNNING", leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    });
    if (!claimed.count) return;
    deadline = setTimeout(() => abort.abort(new AppError("ANALYSIS_TIMEOUT", "Research reached its time limit. Revise your idea and try again.", 504)), getServerEnv().ANALYSIS_TIMEOUT_MS);
    let renewing = false;
    heartbeat = setInterval(() => {
      if (renewing || abort.signal.aborted) return;
      renewing = true;
      void db().analysis.updateMany({
        where: { id: analysisId, status: "RUNNING", leaseExpiresAt: { gt: new Date() } },
        data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
      }).then((result) => { if (!result.count) abort.abort(new AppError("LEASE_LOST", "Research was interrupted. Please start again.", 503)); })
        .catch(() => abort.abort(new AppError("DATABASE_UNAVAILABLE", "Research lost its database connection. Please try again.", 503)))
        .finally(() => { renewing = false; });
    }, 15000);
    await jobContext.run(abort.signal, () => abortable(runAnalysis(analysisId), abort.signal));
  } catch (error) {
    await failAnalysis(analysisId, abort.signal.aborted ? abort.signal.reason : error)
      .catch(() => logEvent("analysis_failure_write_failed", { analysisId }));
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (deadline) clearTimeout(deadline);
  }
}

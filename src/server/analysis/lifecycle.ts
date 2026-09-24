import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import { db } from "../db/client";
import { AppError, logEvent, publicError } from "../errors";

export const LEASE_MS = 60000;
export const activeStatuses = ["QUEUED", "RUNNING"] as const;
export const jobContext = new AsyncLocalStorage<AbortSignal>();
export function assertJobActive() { jobContext.getStore()?.throwIfAborted(); }
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
export async function withTimeBudget<T>(milliseconds: number, work: () => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const parent = jobContext.getStore();
  const signal = parent ? AbortSignal.any([parent, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(new AppError("AI_BUDGET", "This AI step took too long; the available research has been kept.", 504)), milliseconds);
  try { return await jobContext.run(signal, () => abortable(work(), signal)); }
  finally { clearTimeout(timer); }
}
export function requestSignal(timeout: number) {
  const job = jobContext.getStore();
  return job ? AbortSignal.any([job, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
}
export async function recoverExpiredAnalyses(client: Pick<Prisma.TransactionClient, "analysis"> = db()) {
  const now = new Date();
  return client.analysis.updateMany({
    where: { status: { in: [...activeStatuses] }, OR: [
      { leaseExpiresAt: { lte: now } },
      { leaseExpiresAt: null, updatedAt: { lte: new Date(now.getTime() - LEASE_MS) } },
    ] },
    data: { status: "FAILED", currentStage: "FAILED", message: "Research was interrupted",
      error: "The research process stopped responding. You can revise your idea and start again.", completedAt: now, leaseExpiresAt: null },
  });
}
export async function failAnalysis(id: string, error: unknown) {
  await db().analysis.updateMany({
    where: { id, status: { in: [...activeStatuses] } },
    data: { status: "FAILED", currentStage: "FAILED", message: "Research could not finish",
      error: publicError(error), completedAt: new Date(), leaseExpiresAt: null },
  });
  logEvent("analysis_failed", { analysisId: id, code: error instanceof AppError ? error.code : "INTERNAL" });
}

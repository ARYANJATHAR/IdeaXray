import "server-only";
import type { AnalysisInput } from "@/src/lib/analysis-input";
import { db } from "../db/client";
import { getServerEnv } from "../env";
import { AppError } from "../errors";
import { activeStatuses, LEASE_MS, recoverExpiredAnalyses } from "./lifecycle";

export async function admitAnalysis(input: AnalysisInput, ownerHash: string) {
  const env = getServerEnv();
  return db().$transaction(async (tx) => {
    // Acquire a SQLite write lock before counting: admission is atomic across processes.
    await tx.researchGate.update({ where: { id: "global" }, data: { revision: { increment: 1 } } });
    await recoverExpiredAnalyses(tx);
    const createdAt = { gte: new Date(Date.now() - 3600000) };
    const total = await tx.analysis.count({ where: { createdAt } });
    const owned = await tx.analysis.count({ where: { ownerHash, createdAt } });
    if (total >= env.GLOBAL_ANALYSES_PER_HOUR || owned >= env.RATE_LIMIT_PER_HOUR) {
      throw new AppError("RATE_LIMIT", "The hourly research allowance has been reached. Please try again later.", 429);
    }
    const active = await tx.analysis.count({ where: { status: { in: [...activeStatuses] } } });
    if (active >= env.MAX_CONCURRENT_ANALYSES) throw new AppError("CAPACITY", "Research is busy. Please try again when a running analysis finishes.", 429);
    return tx.analysis.create({ data: { originalIdea: input.idea, region: input.region, ownerHash, leaseExpiresAt: new Date(Date.now() + LEASE_MS) } });
  }, { maxWait: 10000, timeout: 15000 });
}

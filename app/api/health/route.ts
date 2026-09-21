import { db } from "@/src/server/db/client";
import { requireResearchConfig } from "@/src/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let configured = true;
  try { requireResearchConfig(); } catch { configured = false; }
  let database = false;
  try { await db().analysis.count(); database = true; } catch { database = false; }
  const ready = configured && database;
  return Response.json({
    status: ready ? "ok" : "setup_required",
    service: "ideaxray",
    researchAvailable: ready,
    checks: { configured, database },
    note: "Readiness checks do not call paid search or AI providers.",
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

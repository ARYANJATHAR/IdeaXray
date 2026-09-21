import { analysisInputSchema } from "@/src/lib/analysis-input";
import { startAnalysis } from "@/src/server/analysis/runner";
import { db } from "@/src/server/db/client";
import { requireResearchConfig } from "@/src/server/env";
import { AppError } from "@/src/server/errors";
import { checkOrigin, ownerHash, rateLimit, readBody } from "@/src/server/http/security";
import { errorResponse, privateHeaders } from "@/src/server/http/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = analysisInputSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new AppError("INPUT", parsed.error.issues[0]?.message ?? "Please check your idea.", 400);
    requireResearchConfig();
    const owner = await ownerHash(true);
    await rateLimit(request, owner);
    const analysis = await db().analysis.create({ data: { originalIdea: parsed.data.idea, region: parsed.data.region, ownerHash: owner } });
    startAnalysis(analysis.id);
    return Response.json({ analysisId: analysis.id, status: "QUEUED" }, { status: 202, headers: privateHeaders });
  } catch (error) { return errorResponse(error); }
}

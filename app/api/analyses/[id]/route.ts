import { readAnalysis } from "@/src/server/analysis/read";
import { errorResponse, privateHeaders } from "@/src/server/http/responses";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await readAnalysis((await params).id), { headers: privateHeaders }); }
  catch (error) { return errorResponse(error); }
}

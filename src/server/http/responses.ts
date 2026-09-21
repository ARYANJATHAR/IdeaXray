import { AppError, logEvent, publicError } from "../errors";
export const privateHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export function errorResponse(error: unknown) {
  logEvent("request_failed", { code: error instanceof AppError ? error.code : "INTERNAL" });
  return Response.json({ error: publicError(error), code: error instanceof AppError ? error.code : "INTERNAL" }, {
    status: error instanceof AppError ? error.status : 503,
    headers: { ...privateHeaders, ...(error instanceof AppError && error.status === 429 ? { "Retry-After": "3600" } : {}) },
  });
}

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 500, public retryable = false) { super(message); this.name = "AppError"; }
}
export function publicError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && process.env.NODE_ENV !== "production") return error.message;
  return "A service is unavailable. Check your configuration and try again.";
}
// Never log provider payloads, raw errors, URLs, credentials, or submitted ideas.
export function logEvent(event: string, fields: { analysisId?: string; engine?: string; durationMs?: number; code?: string } = {}) {
  console.info(JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

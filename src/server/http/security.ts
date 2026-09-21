import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerEnv } from "../env";
import { AppError } from "../errors";

const COOKIE = "ideaxray_session";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const buckets = new Map<string, { count: number; reset: number }>();

export async function ownerHash(create = false) {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) throw new AppError("NOT_FOUND", "This analysis is unavailable in this browser session.", 404);
    token = randomBytes(32).toString("hex");
    jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: new URL(getServerEnv().APP_URL).protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return hash(token);
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(getServerEnv().APP_URL).origin) throw new AppError("ORIGIN", "This request did not come from the configured application.", 403);
}

export async function rateLimit(_request: Request, owner: string) {
  const limit = getServerEnv().RATE_LIMIT_PER_HOUR;
  const now = Date.now();
  const key = "owner:" + owner;
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + 3600000 });
    return;
  }
  if (bucket.count >= limit) throw new AppError("RATE_LIMIT", "The hourly analysis limit has been reached. Please try again later.", 429);
  bucket.count++;
}

export function analysisId(value: string) {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new AppError("NOT_FOUND", "Analysis not found.", 404);
  return result.data;
}

export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("CONTENT_TYPE", "Send the idea as JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("BODY", "A research idea is required.", 400);
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new AppError("BODY_SIZE", "This request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError("BODY", "The request contains invalid JSON.", 400); }
}

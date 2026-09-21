import "server-only";
import { PrismaClient, Prisma } from "@prisma/client";
import { getServerEnv } from "../env";
import { AppError } from "../errors";
const globalDb = globalThis as unknown as { ideaXrayDb?: PrismaClient };
export function db() {
  if (!getServerEnv().DATABASE_URL) throw new AppError("DATABASE_CONFIG", "Configure the database before starting research.", 503);
  if (!globalDb.ideaXrayDb) globalDb.ideaXrayDb = new PrismaClient({ log: [] });
  return globalDb.ideaXrayDb;
}
export function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

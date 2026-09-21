import "server-only";
import { z } from "zod";
import { AppError } from "./errors";

const blankOptional = z.preprocess((v) => v === "" ? undefined : v, z.string().min(1).optional());
const numberSetting = (fallback: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: blankOptional,
  SERPAPI_API_KEY: blankOptional,
  GROQ_API_KEY: blankOptional,
  GROQ_MODEL: blankOptional,
  OPENROUTER_API_KEY: blankOptional,
  OPENROUTER_MODEL: blankOptional,
  SEARCH_TIMEOUT_MS: numberSetting(30000, 1000, 120000),
  AI_TIMEOUT_MS: numberSetting(60000, 1000, 180000),
  RELEVANCE_THRESHOLD: numberSetting(18, 1, 100),
  MIN_SERPAPI_CREDITS: numberSetting(6, 1, 10000),
  MAX_SEARCHES_PER_ANALYSIS: numberSetting(6, 3, 12),
  RATE_LIMIT_PER_HOUR: numberSetting(10, 1, 100),
});

export function getServerEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new AppError("CONFIGURATION", "Some server settings are invalid. Check the environment setup guide.", 503);
  return result.data;
}

export function requireResearchConfig() {
  const env = getServerEnv();
  const missing = ["DATABASE_URL", "SERPAPI_API_KEY"].filter((key) => !env[key as keyof typeof env]);
  if (missing.length) throw new AppError("SETUP_REQUIRED", `Research setup is incomplete. Configure ${missing.join(", ")} in .env.`, 503);
  if (!env.GROQ_API_KEY && !env.OPENROUTER_API_KEY) {
    throw new AppError("SETUP_REQUIRED", "Research setup is incomplete. Configure GROQ_API_KEY or OPENROUTER_API_KEY in .env.", 503);
  }
  return env;
}

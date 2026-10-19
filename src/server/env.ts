import "server-only";
import { z } from "zod";
import { AppError } from "./errors";

const blankOptional = z.preprocess((v) => v === "" ? undefined : v, z.string().min(1).optional());
const numberSetting = (fallback: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: blankOptional,
  SERPAPI_API_KEY: blankOptional,
  AI_PROVIDER: z.literal("azure").default("azure"),
  AZURE_OPENAI_API_KEY: blankOptional,
  AZURE_OPENAI_ENDPOINT: z.preprocess((v) => v === "" ? undefined : v, z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
      && ["", "/", "/openai/v1", "/openai/v1/"].includes(url.pathname);
  }).optional()),
  AZURE_OPENAI_DEPLOYMENT: blankOptional,
  AZURE_OPENAI_REASONING_EFFORT: z.preprocess((v) => v === "" ? undefined : v, z.enum(["minimal", "low", "medium", "high"]).optional()),
  SEARCH_TIMEOUT_MS: numberSetting(30000, 1000, 120000),
  AI_ENRICHMENT: z.enum(["true", "false"]).default("true"),
  AI_TIMEOUT_MS: numberSetting(60000, 1000, 180000),
  AI_TASK_TIMEOUT_MS: numberSetting(45000, 1000, 60000),
  RELEVANCE_THRESHOLD: numberSetting(18, 1, 100),
  MIN_SERPAPI_CREDITS: numberSetting(6, 1, 10000),
  MAX_SEARCHES_PER_ANALYSIS: numberSetting(6, 3, 12),
  RATE_LIMIT_PER_HOUR: numberSetting(10, 1, 100),
  GLOBAL_ANALYSES_PER_HOUR: numberSetting(20, 1, 1000),
  MAX_CONCURRENT_ANALYSES: numberSetting(2, 1, 10),
  ANALYSIS_TIMEOUT_MS: numberSetting(240000, 30000, 270000),
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
  return env;
}

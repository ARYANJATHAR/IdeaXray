import { z } from "zod";
const short = z.string().min(1).max(500);
const strings = z.array(short).max(12);
export const decompositionSchema = z.object({
  title: z.string().min(1).max(120), problem: short, solution: short, targetUsers: strings, technologies: strings,
  mechanisms: strings, synonyms: strings, commercialTerms: strings.min(1), researchTerms: strings.min(1), concepts: strings.min(2).max(8),
});
export const querySchema = z.object({
  patents: z.array(short).min(1).max(2),
  scholar: z.array(short).min(1).max(2),
  web: z.array(short).min(1).max(2),
  news: short,
  shopping: short.optional(),
  trends: z.array(short).min(1).max(5),
});
export const citationSchema = z.array(z.string().uuid()).min(1).max(12);
export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const classificationSchema = z.object({
  items: z.array(z.object({ evidenceId: z.string().uuid(), concepts: strings, entityName: z.string().max(150).nullable(), entityType: z.enum(["PRODUCT", "COMPANY"]).nullable(), entitySummary: z.string().max(600).nullable() })).max(40),
});
export const findingSchema = z.object({ findings: z.array(z.object({ title: short, body: z.string().min(1).max(1200), evidenceIds: citationSchema, confidence: confidenceSchema })).max(6) });
export const gapSchema = z.object({ gaps: z.array(z.object({ concept: short, title: short, body: short, rationale: short, evidenceIds: citationSchema, confidence: confidenceSchema })).max(5) });

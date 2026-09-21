import { z } from "zod";

export const IDEA_MIN_LENGTH = 20;
export const IDEA_MAX_LENGTH = 2000;

export const researchRegions = [
  { value: "worldwide", label: "Worldwide" },
  { value: "india", label: "India" },
  { value: "us", label: "United States" },
  { value: "europe", label: "Europe" },
] as const;

export const analysisInputSchema = z.object({
  idea: z.string().trim()
    .min(IDEA_MIN_LENGTH, "Add a little more detail: describe who it helps and how it works (at least 20 characters).")
    .max(IDEA_MAX_LENGTH, "Keep your idea within 2,000 characters."),
  region: z.enum(["worldwide", "india", "us", "europe"]).default("worldwide"),
});

export type AnalysisInput = z.infer<typeof analysisInputSchema>;

export const exampleIdeas = [
  { label: "A backpack that follows you", idea: "A backpack that automatically follows its owner using computer vision and avoids obstacles." },
  { label: "A smarter hydration bottle", idea: "A reusable water bottle that passively measures hydration and gives personalized drinking reminders." },
  { label: "Less food waste at home", idea: "A kitchen app that tracks groceries, predicts when food will spoil, and suggests recipes to reduce waste." },
  { label: "Reading without barriers", idea: "Lightweight smart glasses that read printed text aloud to help people with low vision navigate everyday life." },
] as const;

import { z } from "zod";
export const FitnessMediaPurposeSchema = z.enum([
  "progress",
  "workout",
  "meal",
]);
export type FitnessMediaPurpose = z.infer<typeof FitnessMediaPurposeSchema>;
export type FitnessProgressMedia = {
  id: string;
  kind: "image" | "video";
  purpose: FitnessMediaPurpose;
  createdAt: string;
  caption?: string;
  comparisonOptIn: boolean;
  url?: string;
};
export const FitnessMediaMetadataSchema = z
  .object({
    caption: z.string().trim().max(1000).optional(),
    comparisonOptIn: z.boolean().optional(),
  })
  .strict();
export const FitnessMealEstimateRequestSchema = z
  .object({ mediaId: z.string().uuid(), consentToAI: z.literal(true) })
  .strict();
export const FitnessMealEstimateSchema = z
  .object({
    label: z.string().trim().min(1).max(150),
    calories: z.number().min(0).max(6000),
    proteinG: z.number().min(0).max(300),
    carbsG: z.number().min(0).max(1000),
    fatG: z.number().min(0).max(400),
    fibreG: z.number().min(0).max(150),
    notes: z.string().max(1000),
    isEstimate: z.literal(true),
  })
  .strict();
export type FitnessMealEstimate = z.infer<typeof FitnessMealEstimateSchema>;

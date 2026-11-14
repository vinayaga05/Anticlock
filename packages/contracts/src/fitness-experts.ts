import { z } from "zod";

export const FitnessExpertKindSchema = z.enum(["trainer", "nutritionist"]);
export type FitnessExpertKind = z.infer<typeof FitnessExpertKindSchema>;
export const FitnessSharingScopeSchema = z.enum([
  "profile",
  "goals",
  "health",
  "workouts",
  "meals",
  "progress",
  "media",
  "plan_write",
]);
export type FitnessSharingScope = z.infer<typeof FitnessSharingScopeSchema>;
export const FitnessExpertQuerySchema = z
  .object({
    kind: FitnessExpertKindSchema.optional(),
    speciality: z.string().trim().max(120).optional(),
    mode: z.enum(["online", "home", "center"]).optional(),
    language: z.string().trim().max(60).optional(),
    maxPrice: z.coerce.number().min(0).max(10000000).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    location: z.string().trim().max(120).optional(),
    available: z.enum(["true", "false"]).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(30).default(20),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type FitnessExpertQuery = z.infer<typeof FitnessExpertQuerySchema>;
export const FitnessExpertSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: FitnessExpertKindSchema,
  categoryId: z.string(),
  categoryLabel: z.string(),
  qualifications: z.array(z.string()),
  qualificationSource: z.literal("approved_application"),
  approvedAt: z.string().datetime().nullable(),
  specialities: z.array(z.string()),
  languages: z.array(z.string()),
  modes: z.array(z.enum(["online", "home", "center"])),
  priceFrom: z.number().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().int(),
  city: z.string().nullable(),
  area: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  available: z.boolean(),
  nextAvailableAt: z.string().datetime().nullable(),
});
export type FitnessExpert = z.infer<typeof FitnessExpertSchema>;
export const FitnessConsentRequestSchema = z
  .object({
    scopes: z.array(FitnessSharingScopeSchema).min(1).max(8),
    resourceIds: z.array(z.string().uuid()).max(100).default([]),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.scopes.some(
        (s) => !["profile", "goals", "health", "plan_write"].includes(s)
      ) &&
      !value.resourceIds.length
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resourceIds"],
        message: "Select the individual logs or media to share.",
      });
  });
export type FitnessConsentRequest = z.infer<typeof FitnessConsentRequestSchema>;
export const FitnessConsentSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
  providerName: z.string(),
  scopes: z.array(FitnessSharingScopeSchema),
  resourceIds: z.array(z.string().uuid()),
  status: z.enum(["active", "revoked"]),
  grantedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});
export type FitnessConsent = z.infer<typeof FitnessConsentSchema>;
export type FitnessShareChoice = {
  id: string;
  scope: FitnessSharingScope;
  label: string;
  date: string | null;
};
export const FitnessConsultationRequestSchema = z
  .object({
    bookingId: z.string().uuid(),
    mode: z.enum(["audio", "video"]).default("video"),
  })
  .strict();
export type FitnessConsultation = {
  id: string;
  bookingId: string;
  providerId: string;
  providerName: string;
  userId: string;
  clientName: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  mode: "audio" | "video";
  serviceMode: string;
  canJoin: boolean;
};
export const FitnessNutritionTargetKeySchema = z.enum([
  "proteinG",
  "carbsG",
  "fatG",
  "fibreG",
  "waterMl",
]);
const targetRange = (min: number, max: number) =>
  z
    .object({
      min: z.number().min(min).max(max),
      max: z.number().min(min).max(max),
    })
    .strict()
    .refine(
      (value) => value.min <= value.max,
      "Minimum must not exceed maximum."
    );
export const FitnessNutritionTargetsSchema = z
  .object({
    proteinG: targetRange(0, 250).optional(),
    carbsG: targetRange(0, 800).optional(),
    fatG: targetRange(0, 200).optional(),
    fibreG: targetRange(0, 70).optional(),
    waterMl: targetRange(500, 5000).optional(),
  })
  .strict();
const PlanExerciseSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    sets: z.number().int().min(1).max(20),
    reps: z.number().int().min(1).max(100).optional(),
    durationSeconds: z.number().int().min(1).max(7200).optional(),
    restSeconds: z.number().int().min(0).max(600).optional(),
    instructions: z.string().trim().max(3000).optional(),
    substitutions: z
      .array(z.string().trim().min(1).max(150))
      .max(10)
      .optional(),
    notes: z.string().trim().max(1000).optional(),
    mediaId: z.string().uuid().optional(),
  })
  .strict();
export const FitnessPlanRevisionSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    title: z.string().trim().min(2).max(160).optional(),
    note: z.string().trim().min(3).max(4000),
    workouts: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            name: z.string().trim().min(1).max(160),
            durationMinutes: z.number().int().min(1).max(180),
            exercises: z.array(PlanExerciseSchema).min(1).max(30),
          })
          .strict()
      )
      .max(14)
      .optional(),
    nutrition: z
      .object({
        guidance: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
        calories: z
          .object({
            min: z.number().int().min(1200).max(5000),
            max: z.number().int().min(1200).max(5000),
          })
          .refine((v) => v.min <= v.max, "Minimum must not exceed maximum.")
          .nullable(),
        targets: FitnessNutritionTargetsSchema.optional(),
        clearTargets: z
          .array(FitnessNutritionTargetKeySchema)
          .max(5)
          .optional(),
      })
      .strict()
      .optional(),
    habits: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(100),
            label: z.string().trim().min(1).max(120),
            target: z.number().min(0).max(30000),
            unit: z.string().trim().min(1).max(40),
          })
          .strict()
      )
      .max(20)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.workouts && !value.nutrition && !value.habits)
      context.addIssue({
        code: "custom",
        message: "Change at least one plan section.",
      });
    for (const [index, habit] of (value.habits ?? []).entries()) {
      const key = habit.key.toLowerCase();
      const unit = habit.unit.toLowerCase();
      const invalid =
        (key.includes("water") &&
          (unit !== "ml" || habit.target < 500 || habit.target > 5000)) ||
        (key.includes("sleep") &&
          (unit !== "hours" || habit.target < 4 || habit.target > 12)) ||
        (key.includes("steps") && (unit !== "steps" || habit.target > 30000));
      if (invalid)
        context.addIssue({
          code: "custom",
          path: ["habits", index, "target"],
          message: "Choose a sensible target and matching unit for this habit.",
        });
    }
  });
export type FitnessPlanRevision = z.infer<typeof FitnessPlanRevisionSchema>;
export type FitnessWorkspaceClient = {
  providerId: string;
  userId: string;
  displayName: string;
  scopes: FitnessSharingScope[];
  resourceIds: string[];
  plan: { id: string; title: string; version: number } | null;
};
export type FitnessWorkspace = {
  providers: {
    id: string;
    name: string;
    kind: FitnessExpertKind;
    canPublish: boolean;
  }[];
  clients: FitnessWorkspaceClient[];
  consultations: FitnessConsultation[];
};

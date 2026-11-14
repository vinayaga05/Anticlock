import { z } from "zod";

export const FitnessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date.");
const note = z.string().trim().max(3000);
const strings = z.array(z.string().trim().min(1).max(120)).max(40);
export const FitnessRemindersSchema = z
  .object({
    enabled: z.boolean(),
    workouts: z.boolean(),
    meals: z.boolean(),
    water: z.boolean(),
    habits: z.boolean(),
    weeklySummary: z.boolean(),
    workoutTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    mealTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    waterTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    habitTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    weeklySummaryTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
  })
  .strict();
export const FitnessAssessmentSchema = z
  .object({
    reminders: FitnessRemindersSchema.optional(),
    dateOfBirth: FitnessDateSchema.optional(),
    gender: z.string().trim().max(80).optional(),
    bodyDescription: note.optional(),
    calculationSex: z.enum(["female", "male", "unspecified"]).optional(),
    heightCm: z.number().min(50).max(260).optional(),
    weightKg: z.number().min(15).max(500).optional(),
    units: z.enum(["metric", "imperial"]).optional(),
    goals: z
      .array(
        z.enum([
          "general_wellness",
          "strength",
          "endurance",
          "mobility",
          "weight_management",
          "balanced_nutrition",
          "better_sleep",
          "weight_loss",
          "muscle_gain",
          "fitness",
          "flexibility",
          "maintenance",
          "rehabilitation_support",
        ])
      )
      .max(14)
      .optional(),
    activityLevel: z
      .enum(["sedentary", "light", "moderate", "active", "very_active"])
      .optional(),
    experience: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    exercisePreferences: strings.optional(),
    equipment: strings.optional(),
    availableDays: z.array(z.number().int().min(0).max(6)).max(14).optional(),
    preferredTimes: strings.optional(),
    sessionMinutes: z.number().int().min(5).max(180).optional(),
    foodPreferences: strings.optional(),
    allergies: strings.optional(),
    restrictions: strings.optional(),
    injuries: note.optional(),
    mobility: note.optional(),
    medicalConditions: note.optional(),
    medications: note.optional(),
    pregnant: z.boolean().optional(),
    breastfeeding: z.boolean().optional(),
    eatingDisorderRisk: z.boolean().optional(),
    clinicalReviewRequired: z.boolean().optional(),
    sleepHours: z.number().min(0).max(24).optional(),
    stressLevel: z.enum(["low", "moderate", "high"]).optional(),
    waterMl: z.number().min(0).max(15000).optional(),
    routine: note.optional(),
    targetWeightKg: z.number().min(15).max(500).optional(),
    targetDate: FitnessDateSchema.optional(),
    timezone: z.string().max(100).optional(),
    disclaimerAccepted: z.boolean().optional(),
  })
  .strict();
export type FitnessAssessment = z.infer<typeof FitnessAssessmentSchema>;
type FitnessAssessmentShape = typeof FitnessAssessmentSchema.shape;
const fitnessAssessmentPatchShape = Object.fromEntries(
  Object.entries(FitnessAssessmentSchema.shape).map(([key, schema]) => [
    key,
    schema.nullable(),
  ])
) as {
  [K in keyof FitnessAssessmentShape]: z.ZodNullable<FitnessAssessmentShape[K]>;
};
/** Null explicitly removes a previously saved optional answer; omitted fields retain the saved value. */
export const FitnessAssessmentPatchSchema = z
  .object(fitnessAssessmentPatchShape)
  .strict();
export type FitnessAssessmentPatch = z.infer<
  typeof FitnessAssessmentPatchSchema
>;

export const CompleteFitnessAssessmentSchema = FitnessAssessmentSchema.required(
  {
    dateOfBirth: true,
    heightCm: true,
    weightKg: true,
    goals: true,
    activityLevel: true,
    experience: true,
    availableDays: true,
    equipment: true,
    foodPreferences: true,
  }
).superRefine((v, c) => {
  if (!v.goals.length)
    c.addIssue({
      code: "custom",
      path: ["goals"],
      message: "Choose at least one goal.",
    });
  if (!v.availableDays.length)
    c.addIssue({
      code: "custom",
      path: ["availableDays"],
      message: "Choose at least one available day.",
    });
  if (!v.foodPreferences.length)
    c.addIssue({
      code: "custom",
      path: ["foodPreferences"],
      message: "Add a food preference, including no preference.",
    });
  if (!v.disclaimerAccepted)
    c.addIssue({
      code: "custom",
      path: ["disclaimerAccepted"],
      message: "Read and accept the wellness guidance.",
    });
});
export type CompleteFitnessAssessment = z.infer<
  typeof CompleteFitnessAssessmentSchema
>;
export const FitnessBaselineSchema = z.object({
  age: z.number(),
  bmi: z.number().nullable(),
  bmr: z.object({ min: z.number(), max: z.number() }).nullable(),
  tdee: z.object({ min: z.number(), max: z.number() }).nullable(),
  calories: z.object({ min: z.number(), max: z.number() }).nullable(),
  proteinG: z.object({ min: z.number(), max: z.number() }).nullable(),
  carbsG: z.object({ min: z.number(), max: z.number() }).nullable(),
  fatG: z.object({ min: z.number(), max: z.number() }).nullable(),
  fibreG: z.number().nullable(),
  waterMl: z.number().nullable(),
  requiresProfessionalReview: z.boolean(),
  assumptions: z.array(z.string()),
  guidance: z.array(z.string()),
});
export type FitnessBaseline = z.infer<typeof FitnessBaselineSchema>;
export type FitnessProfile = {
  assessmentStart?: { date: string; weightKg: number };
  id: string;
  assessment: FitnessAssessment;
  status: "draft" | "complete";
  baseline: FitnessBaseline | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export const FitnessNutrientsSchema = z
  .object({
    calories: z.number().min(0).max(20000),
    proteinG: z.number().min(0).max(1000),
    carbsG: z.number().min(0).max(3000),
    fatG: z.number().min(0).max(1500),
    fibreG: z.number().min(0).max(500),
  })
  .strict();
export type FitnessNutrients = z.infer<typeof FitnessNutrientsSchema>;
export const FitnessExerciseSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    sets: z
      .array(
        z.object({
          reps: z.number().int().min(0).max(1000).optional(),
          weightKg: z.number().min(0).max(1000).optional(),
          durationSeconds: z.number().int().min(0).max(86400).optional(),
          distanceMetres: z.number().min(0).max(300000).optional(),
        })
      )
      .max(100),
    notes: note.optional(),
  })
  .strict();
export const FitnessWorkoutDataSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    status: z.enum(["in_progress", "paused", "completed", "skipped"]),
    exercises: z.array(FitnessExerciseSchema).max(100),
    durationMinutes: z.number().min(0).max(1440).optional(),
    calories: z.number().min(0).max(20000).optional(),
    notes: note.optional(),
    painNote: note.optional(),
    helpRequested: z.boolean().optional(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    planId: z.string().uuid().optional(),
    planDay: z.number().int().min(0).max(6).optional(),
    planVersion: z.number().int().min(1).optional(),
    mediaIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .strict();
export const FitnessMealDataSchema = z
  .object({
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    foods: z
      .array(
        z.object({
          foodId: z.string().uuid().optional(),
          name: z.string().trim().min(1).max(150),
          servings: z.number().positive().max(100),
          nutrients: FitnessNutrientsSchema,
        })
      )
      .min(1)
      .max(100),
    notes: note.optional(),
    mediaIds: z.array(z.string().uuid()).max(10).optional(),
    estimate: z.boolean().optional(),
  })
  .strict();
export const FitnessLogKindSchema = z.enum([
  "workout",
  "meal",
  "water",
  "habit",
  "sleep",
  "steps",
  "weight",
]);
export type FitnessLogKind = z.infer<typeof FitnessLogKindSchema>;
export const FitnessLogDataSchemas = {
  workout: FitnessWorkoutDataSchema,
  meal: FitnessMealDataSchema,
  water: z
    .object({
      amountMl: z.number().int().positive().max(15000),
      notes: note.optional(),
    })
    .strict(),
  habit: z
    .object({
      key: z.string().trim().min(1).max(100),
      completed: z.boolean(),
      notes: note.optional(),
    })
    .strict(),
  sleep: z
    .object({
      durationMinutes: z.number().int().min(0).max(1440),
      quality: z.enum(["poor", "fair", "good"]).optional(),
      notes: note.optional(),
    })
    .strict(),
  steps: z
    .object({
      count: z.number().int().min(0).max(200000),
      notes: note.optional(),
    })
    .strict(),
  weight: z
    .object({
      weightKg: z.number().min(15).max(500),
      waistCm: z.number().min(20).max(350).optional(),
      notes: note.optional(),
    })
    .strict(),
};
export type FitnessLogData = {
  [K in FitnessLogKind]: z.infer<(typeof FitnessLogDataSchemas)[K]>;
}[FitnessLogKind];
export type FitnessLog = {
  id: string;
  kind: FitnessLogKind;
  date: string;
  data: FitnessLogData;
  createdAt: string;
  updatedAt: string;
};
export const FitnessCreateLogSchema = z
  .object({
    date: FitnessDateSchema,
    clientRequestId: z.string().uuid().optional(),
    data: z.unknown(),
  })
  .strict();
export const FitnessWorkoutActionSchema = z
  .object({
    action: z.enum(["pause", "resume", "complete", "skip", "request_help"]),
    painNote: note.optional(),
  })
  .strict();
export const FitnessFoodInputSchema = z
  .object({
    clientRequestId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(150),
    servingName: z.string().trim().min(1).max(100),
    servingGrams: z.number().positive().max(10000),
    nutrients: FitnessNutrientsSchema,
  })
  .strict();
export type FitnessFood = z.infer<typeof FitnessFoodInputSchema> & {
  id: string;
  source: "custom" | "curated" | "open_food_facts";
  barcode?: string;
  isEstimate?: boolean;
  missingNutrients?: Array<keyof FitnessNutrients>;
};
export const FitnessRecipeInputSchema = z
  .object({
    clientRequestId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(150),
    servings: z.number().positive().max(100),
    ingredients: z
      .array(
        z.object({
          foodId: z.string().uuid(),
          servings: z.number().positive().max(100),
        })
      )
      .min(1)
      .max(100),
    notes: note.optional(),
  })
  .strict();
export type FitnessRecipe = z.infer<typeof FitnessRecipeInputSchema> & {
  id: string;
  nutrients: FitnessNutrients;
};
export type FitnessPlanContent = {
  baselineTargets?: Pick<
    FitnessBaseline,
    "proteinG" | "carbsG" | "fatG" | "fibreG" | "waterMl"
  >;
  expertFeedback?: {
    note: string;
    providerId: string;
    createdAt: string;
    version: number;
  };
  name: string;
  description: string;
  requiresProfessionalReview: boolean;
  workouts: Array<{
    day: number;
    name: string;
    durationMinutes: number;
    exercises: Array<{
      name: string;
      sets: number;
      reps?: number;
      durationSeconds?: number;
      notes?: string;
      restSeconds?: number;
      instructions?: string;
      substitutions?: string[];
      mediaId?: string;
    }>;
  }>;
  nutrition: {
    targets?: {
      proteinG?: FitnessTargetRange;
      carbsG?: FitnessTargetRange;
      fatG?: FitnessTargetRange;
      fibreG?: FitnessTargetRange;
      waterMl?: FitnessTargetRange;
    };
    guidance: string[];
    calories: { min: number; max: number } | null;
  };
  habits: Array<{ key: string; label: string; target: number; unit: string }>;
  assumptions: string[];
};
export type FitnessPlan = {
  id: string;
  title: string;
  status: string;
  currentVersion: number;
  providerId: string | null;
  content: FitnessPlanContent;
  createdAt: string;
  updatedAt: string;
};
export type FitnessPlanVersion = {
  id: string;
  planId: string;
  version: number;
  authorProviderId: string | null;
  content: FitnessPlanContent;
  createdAt: string;
};
export type FitnessDayTotals = {
  recordedKinds?: FitnessLogKind[];
  date: string;
  workouts: number;
  workoutMinutes: number;
  nutrients: FitnessNutrients;
  waterMl: number;
  steps: number;
  sleepMinutes: number;
  habitsCompleted: number;
  weightKg: number | null;
  active: boolean;
};
export type FitnessSummary = {
  latestWeight?: FitnessWeightSnapshot | null;
  weightProgress?: FitnessWeightProgress | null;
  targets?: FitnessTargets | null;
  targetStatus?: FitnessTargetStatus;
  todayWorkout?: FitnessWorkoutComparison | null;
  date: string;
  timezone: string;
  profile: FitnessProfile | null;
  plan: FitnessPlan | null;
  today: FitnessDayTotals;
  weekly: {
    plannedDays?: number;
    completedPlannedDays?: number;
    plannedWorkouts?: number;
    completedPlannedWorkouts?: number;
    completionPercent?: number | null;
    consistencyPercent?: number | null;
    dueDates?: string[];
    activeDays: number;
    workouts: number;
    workoutMinutes: number;
    streak: number;
    days: FitnessDayTotals[];
  };
  logs: FitnessLog[];
};
export type FitnessProgress = {
  latestWeight?: FitnessWeightSnapshot | null;
  currentWeightProgress?: FitnessWeightProgress | null;
  currentTargets?: FitnessTargets | null;
  targetStatus?: FitnessTargetStatus;
  comparisons?: FitnessDayComparison[];
  targetBasisNotice?: string;
  adherence?: {
    recordedDays: number;
    nutritionRecordedDays: number;
    nutritionInRangeDays: number;
    nutritionInRangePercent: number | null;
    plannedWorkouts: number;
    completedPlannedWorkouts: number;
    completionPercent: number | null;
  };
  currentStreak?: number;
  longestStreak?: number;
  from: string;
  to: string;
  timezone: string;
  days: FitnessDayTotals[];
  totals: {
    workouts: number;
    workoutMinutes: number;
    activeDays: number;
    waterMl: number;
    steps: number;
    sleepMinutes: number;
    habitsCompleted: number;
    nutrients: FitnessNutrients;
  };
  streak: number;
  weightChangeKg: number | null;
  strength: Array<{
    exercise: string;
    maxWeightKg: number;
    totalReps: number;
    hasRecordedLoad?: boolean;
    series?: Array<{ date: string; maxWeightKg: number; totalReps: number }>;
    weightChangeKg?: number | null;
  }>;
  insights: string[];
};

/** External catalog data is imported only after the person explicitly selects a result. */
export type FitnessCatalogFood = Omit<FitnessFood, "id"> & {
  barcode: string;
  isEstimate: true;
  missingNutrients: Array<keyof FitnessNutrients>;
};
export type FitnessFoodSearchResponse = {
  foods: FitnessCatalogFood[];
  source: "open_food_facts";
  notice: string;
};
export const FitnessFoodImportSchema = z
  .object({ barcode: z.string().regex(/^\d{8,14}$/) })
  .strict();

export type FitnessTargetRange = { min: number; max: number };
export type FitnessTargetStatus =
  | "available"
  | "no_plan"
  | "needs_review"
  | "unavailable";
export type FitnessTargets = {
  calories: FitnessTargetRange | null;
  proteinG: FitnessTargetRange | null;
  carbsG: FitnessTargetRange | null;
  fatG: FitnessTargetRange | null;
  fibreG: FitnessTargetRange | null;
  waterMl: FitnessTargetRange | null;
  steps: FitnessTargetRange | null;
  sleepMinutes: FitnessTargetRange | null;
  habits: Array<{ key: string; label: string; target: number; unit: string }>;
};
export type FitnessWeightSnapshot = {
  weightKg: number;
  date: string;
  source: "measurement" | "assessment";
};
export type FitnessWeightProgress = {
  startWeightKg: number;
  currentWeightKg: number;
  targetWeightKg: number | null;
  changeKg: number;
  remainingKg: number | null;
  progressPercent: number | null;
  source: "measurement" | "assessment";
  date: string;
  startDate: string;
  startSource: "initial_assessment" | "current_assessment";
};
export type FitnessTargetComparison = {
  actual: number;
  targetMin: number;
  targetMax: number;
  percent: number | null;
  inRange: boolean;
  relation: "below" | "within" | "above";
};
export type FitnessWorkoutComparison = {
  planned: number;
  completed: number;
  completionPercent: number | null;
};
export type FitnessDayComparison = {
  date: string;
  planId: string | null;
  version: number | null;
  basis: "saved_plan_version" | "current_targets" | "unavailable";
  targets: FitnessTargets | null;
  nutrition: {
    calories: FitnessTargetComparison | null;
    proteinG: FitnessTargetComparison | null;
    carbsG: FitnessTargetComparison | null;
    fatG: FitnessTargetComparison | null;
    fibreG: FitnessTargetComparison | null;
  } | null;
  water: FitnessTargetComparison | null;
  steps: FitnessTargetComparison | null;
  sleep: FitnessTargetComparison | null;
  workout: FitnessWorkoutComparison | null;
};

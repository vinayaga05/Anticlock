import type {
  FitnessExpertKind,
  FitnessSharingScope,
} from "@anticlock/contracts";
const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
        .map((v) => v.trim())
    : text(value)
    ? [text(value)!]
    : [];
function field(data: Record<string, unknown>, key: string) {
  return (
    data[key] ??
    key.split(".").reduce<unknown>((value, k) => objectValue(value)[k], data)
  );
}
export function sharedFitnessProfile(
  profile: unknown,
  scope: FitnessSharingScope
) {
  if (!["profile", "goals", "health"].includes(scope)) return {};
  const assessment = objectValue(objectValue(profile).assessment);
  const keys =
    scope === "profile"
      ? [
          "heightCm",
          "weightKg",
          "units",
          "activityLevel",
          "experience",
          "exercisePreferences",
          "foodPreferences",
          "equipment",
          "availableDays",
          "preferredTimes",
          "sessionMinutes",
        ]
      : scope === "goals"
      ? ["goals", "targetWeightKg", "targetDate"]
      : [
          "medicalConditions",
          "medications",
          "injuries",
          "mobility",
          "pregnant",
          "breastfeeding",
          "eatingDisorderRisk",
          "clinicalReviewRequired",
          "allergies",
          "restrictions",
        ];
  const result: Record<string, unknown> = {};
  for (const key of keys) if (key in assessment) result[key] = assessment[key];
  if (scope === "profile") {
    const baseline = objectValue(objectValue(profile).baseline);
    if (typeof baseline.age === "number") result.age = baseline.age;
  }
  return result;
}

/** Qualification text comes only from the approved source application, never an editable badge. */
export function approvedFitnessQualifications(
  kind: FitnessExpertKind,
  payload: unknown
) {
  const data = objectValue(payload);
  const keys =
    kind === "trainer"
      ? ["trainer.certifications", "trainer.qualification"]
      : [
          "nutrition.qualification",
          "nutrition.certifications",
          "medical.qualification",
        ];
  return [...new Set(keys.flatMap((key) => list(field(data, key))))]
    .slice(0, 20)
    .map((s) => s.slice(0, 500));
}
export function fitnessCategoryKind(
  categoryId: string
): FitnessExpertKind | null {
  if (
    ["wellness.nutrition_clinical", "wellness.nutrition_sports"].includes(
      categoryId
    )
  )
    return "nutritionist";
  if (
    [
      "fitness.personal_trainer",
      "fitness.yoga",
      "fitness.aerobics_zumba",
      "fitness.sports_fitness",
      "fitness.bodybuilding",
      "fitness.crossfit",
      "fitness.geriatric",
    ].includes(categoryId)
  )
    return "trainer";
  return null;
}
export function consultationCanJoin(
  booking: {
    status: string;
    serviceMode: string;
    startsAt: Date;
    endsAt: Date | null;
    durationMinutes: number | null;
  },
  now = new Date()
) {
  const start = booking.startsAt.getTime(),
    end =
      booking.endsAt?.getTime() ??
      start + (booking.durationMinutes ?? 60) * 60000;
  return (
    booking.status === "confirmed" &&
    booking.serviceMode === "online" &&
    now.getTime() >= start - 900000 &&
    now.getTime() <= end + 1800000
  );
}

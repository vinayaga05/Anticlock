import type {
  FitnessAssessment,
  FitnessBaseline,
  FitnessPlanContent,
} from "@anticlock/contracts";
import { ApiError } from "../lib/httpError.js";

const DAY = 86_400_000;
const rounded = (value: number, unit = 1) =>
  Number((Math.round(value / unit) * unit).toFixed(8));
const range = (min: number, max: number, unit = 1) => ({
  min: rounded(min, unit),
  max: rounded(max, unit),
});
const nonempty = (value?: string) => !!value?.trim();

export function fitnessLocalDate(
  now = new Date(),
  timezone = "Asia/Kolkata"
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    return ["year", "month", "day"]
      .map((kind) => parts.find((part) => part.type === kind)?.value)
      .join("-");
  } catch {
    throw new ApiError(422, "invalid_timezone", "Choose a valid time zone.");
  }
}

export function fitnessAge(
  dateOfBirth: string,
  now = new Date(),
  timezone = "Asia/Kolkata"
): number {
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dateOfBirth
  )
    throw new ApiError(
      422,
      "invalid_date_of_birth",
      "Enter a valid date of birth."
    );
  const today = fitnessLocalDate(now, timezone);
  if (dateOfBirth > today)
    throw new ApiError(
      422,
      "invalid_date_of_birth",
      "Date of birth cannot be in the future."
    );
  const age =
    Number(today.slice(0, 4)) -
    Number(dateOfBirth.slice(0, 4)) -
    (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
  if (age > 120)
    throw new ApiError(
      422,
      "invalid_date_of_birth",
      "Check the date of birth."
    );
  return age;
}

/** Screening estimates, never a diagnosis or an individualized medical diet.
 * Original Mifflin et al. 1990: doi:10.1093/ajcn/51.2.241.
 * NIDDK planner excludes under-18s/pregnancy/breastfeeding; CDC adult BMI
 * interpretation starts at20. Gender identity is never a calculation input.
 */
export function buildFitnessBaseline(
  assessment: FitnessAssessment,
  now = new Date()
): FitnessBaseline {
  if (!assessment.dateOfBirth || !assessment.heightCm || !assessment.weightKg)
    throw new ApiError(
      422,
      "assessment_incomplete",
      "Add date of birth, height and weight first."
    );
  const age = fitnessAge(assessment.dateOfBirth, now, assessment.timezone);
  const { heightCm: height, weightKg: weight } = assessment;
  if (
    !Number.isFinite(height) ||
    height < 50 ||
    height > 260 ||
    !Number.isFinite(weight) ||
    weight < 15 ||
    weight > 500
  )
    throw new ApiError(
      422,
      "invalid_measurement",
      "Check the height and weight."
    );
  const rawBmi = weight / (height / 100) ** 2;
  const bmi = age >= 18 ? rounded(rawBmi, 0.1) : null;
  const today = fitnessLocalDate(now, assessment.timezone);
  if (assessment.targetDate && assessment.targetDate <= today)
    throw new ApiError(
      422,
      "invalid_target_date",
      "Choose a target date after today."
    );
  if (
    assessment.targetDate &&
    new Date(`${assessment.targetDate}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime() >
      5 * 366 * DAY
  )
    throw new ApiError(
      422,
      "invalid_target_date",
      "Choose a target date within the next five years."
    );
  if (
    age >= 20 &&
    assessment.targetWeightKg &&
    assessment.targetWeightKg / (height / 100) ** 2 < 18.5
  )
    throw new ApiError(
      422,
      "unsafe_weight_target",
      "Review this weight target with a qualified professional."
    );
  if (
    assessment.targetWeightKg &&
    assessment.targetDate &&
    assessment.targetWeightKg < weight
  ) {
    const weeks =
      (new Date(`${assessment.targetDate}T00:00:00Z`).getTime() -
        new Date(`${today}T00:00:00Z`).getTime()) /
      (7 * DAY);
    if (weeks > 0 && (weight - assessment.targetWeightKg) / weeks > 0.9)
      throw new ApiError(
        422,
        "unsafe_weight_timeline",
        "Choose a longer timeline or review this target with a qualified professional."
      );
  }
  const goals = assessment.goals ?? [];
  const reasons: string[] = [];
  if (age < 18)
    reasons.push(
      "A qualified professional should guide goals and nutrition for anyone under18."
    );
  if (assessment.pregnant || assessment.breastfeeding)
    reasons.push(
      "Pregnancy or breastfeeding needs personalized professional guidance."
    );
  if (assessment.eatingDisorderRisk)
    reasons.push(
      "A qualified professional should guide nutrition and body-weight goals."
    );
  if (
    assessment.clinicalReviewRequired ||
    goals.includes("rehabilitation_support")
  )
    reasons.push(
      "Professional review is needed before a tailored exercise or nutrition plan."
    );
  if (
    [
      assessment.injuries,
      assessment.mobility,
      assessment.medicalConditions,
      assessment.medications,
    ].some(nonempty)
  )
    reasons.push(
      "Your optional health information calls for professional review."
    );
  if (bmi !== null && rawBmi < 18.5)
    reasons.push(
      "Review energy and body-weight goals with a qualified professional."
    );
  const assumptions = [
    "Starter wellness estimates only; individual needs vary and results are not guaranteed.",
    "Resting energy uses the Mifflin–St Jeor equation; TDEE uses self-reported activity, not measured expenditure.",
  ];
  if (age < 20)
    assumptions.push("Adult BMI categories are not applied below age20.");
  else
    assumptions.push(
      "BMI is a screening measure and does not diagnose health or body composition."
    );
  const sex = assessment.calculationSex;
  if (!sex || sex === "unspecified")
    assumptions.push(
      "No calculation-sex input was supplied; energy estimates span both equation constants. Gender was not used."
    );
  const guidance = [
    "If symptoms are severe or sudden, contact local emergency services. Chat and consultations are not emergency care.",
  ];
  const base = {
    age,
    bmi,
    bmr: null,
    tdee: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fibreG: null,
    waterMl: null,
    requiresProfessionalReview: reasons.length > 0,
    assumptions,
    guidance,
  } satisfies FitnessBaseline;
  if (reasons.length) return { ...base, guidance: [...reasons, ...guidance] };

  // Use the published regression, not the user's gender as a proxy.
  const common = 9.99 * weight + 6.25 * height - 4.92 * age - 161;
  const bmr = range(
    common + (sex === "male" ? 166 : 0),
    common + (sex === "female" ? 0 : 166),
    5
  );
  const multiplier = {
    sedentary: 1.4,
    light: 1.6,
    moderate: 1.8,
    active: 2.0,
    very_active: 2.2,
  }[assessment.activityLevel ?? "sedentary"];
  const tdee = range(bmr.min * multiplier, bmr.max * multiplier, 50);
  let calories = { ...tdee };
  if (goals.includes("weight_loss"))
    calories = range(tdee.min * 0.95, tdee.max * 0.95, 50);
  else if (goals.includes("muscle_gain"))
    calories = range(tdee.min + 100, tdee.max + 150, 50);
  // Conservative product guard, not a claim that one intake suits everybody.
  if (calories.min < 1500 || calories.max > 6000 || bmr.min <= 0)
    return {
      ...base,
      bmr,
      tdee,
      requiresProfessionalReview: true,
      guidance: [
        "This estimate is outside the starter plan range. Ask a qualified professional to review your targets.",
        ...guidance,
      ],
    };
  const strength = goals.some((goal) =>
    ["strength", "muscle_gain"].includes(goal)
  );
  const proteinG = range(
    (calories.min * (strength ? 0.2 : 0.15)) / 4,
    Math.min((calories.max * 0.25) / 4, weight * (strength ? 1.6 : 1.2))
  );
  if (proteinG.max < proteinG.min) proteinG.min = proteinG.max;
  assumptions.push(
    "Macro ranges are broad editable starting points, not a medical diet or an exact meal prescription."
  );
  assumptions.push(
    "The 2L drinking-water habit is a starting preference, not total dietary fluid needs. Needs vary with climate and activity."
  );
  guidance.unshift(
    "Ask an approved trainer or nutritionist to review these estimates before making significant changes."
  );
  return {
    age,
    bmi,
    bmr,
    tdee,
    calories,
    proteinG,
    carbsG: range((calories.min * 0.45) / 4, (calories.max * 0.6) / 4),
    fatG: range((calories.min * 0.25) / 9, (calories.max * 0.35) / 9),
    fibreG: rounded((((calories.min + calories.max) / 2) * 14) / 1000),
    waterMl: 2000,
    requiresProfessionalReview: false,
    assumptions,
    guidance,
  };
}

type Exercise = FitnessPlanContent["workouts"][number]["exercises"][number];
const exercise = (
  name: string,
  sets: number,
  reps: number | undefined,
  instructions: string,
  substitutions: string[],
  durationSeconds?: number
): Exercise => ({
  name,
  sets,
  ...(reps ? { reps } : {}),
  ...(durationSeconds ? { durationSeconds } : {}),
  restSeconds: 60,
  instructions,
  substitutions,
  notes:
    "Use a comfortable range. Stop if you feel pain, dizziness or unusual breathlessness.",
});

export function buildFitnessStarterPlan(
  assessment: FitnessAssessment,
  baseline: FitnessBaseline,
  now = new Date()
): FitnessPlanContent {
  // Recheck the current assessment rather than trusting a stale or mismatched cached baseline.
  const requiresProfessionalReview =
    baseline.requiresProfessionalReview ||
    buildFitnessBaseline(assessment, now).requiresProfessionalReview;
  const days = [...new Set(assessment.availableDays ?? [])].sort(
    (a, b) => a - b
  );
  const goals = assessment.goals ?? [];
  const preferences = (assessment.exercisePreferences ?? [])
    .join(" ")
    .toLowerCase();
  const equipment = (assessment.equipment ?? []).join(" ").toLowerCase();
  const minutes = Math.min(
    assessment.sessionMinutes ?? 20,
    assessment.experience === "beginner" ? 30 : 60
  );
  const strength = goals.some((goal) =>
    ["strength", "muscle_gain"].includes(goal)
  );
  const mobility =
    goals.some((goal) => ["mobility", "flexibility"].includes(goal)) ||
    /stretch|yoga|mobility/.test(preferences);
  const sets =
    minutes < 20
      ? 1
      : assessment.experience === "advanced"
      ? 3
      : assessment.experience === "intermediate"
      ? 2
      : 1;
  const preparationSeconds = Math.min(
    300,
    Math.max(60, Math.floor(minutes * 60 * 0.2))
  );
  const nutrition = [
    "Use regular, varied meals and review portions according to your needs and preferences.",
    "Food and meal-photo nutrition estimates are editable. Check package labels and portions; an image cannot establish allergens or medical suitability.",
    assessment.foodPreferences?.length
      ? `Plan around your selected preferences: ${assessment.foodPreferences.join(
          ", "
        )}.`
      : "Choose meals that fit your food preferences.",
    ...(assessment.allergies?.length || assessment.restrictions?.length
      ? [
          "Check every ingredient against your allergies and restrictions. Ask a qualified nutrition professional when unsure.",
        ]
      : []),
  ];
  const assumptions = [
    ...baseline.assumptions,
    "This starter schedule is generated from your saved assessment. It is not a trainer-authored or medical treatment plan.",
  ];
  const baselineTargets = requiresProfessionalReview
    ? { proteinG: null, carbsG: null, fatG: null, fibreG: null, waterMl: null }
    : {
        proteinG: baseline.proteinG,
        carbsG: baseline.carbsG,
        fatG: baseline.fatG,
        fibreG: baseline.fibreG,
        waterMl: baseline.waterMl,
      };
  if (requiresProfessionalReview)
    return {
      name: "Your wellness review",
      description:
        "Keep your assessment and logs together, then choose a qualified professional to personalize the next steps.",
      requiresProfessionalReview: true,
      baselineTargets,
      workouts: [],
      nutrition: {
        guidance: [
          "Professional review is needed before tailored nutrition targets.",
          ...nutrition,
        ],
        calories: null,
      },
      habits: [
        {
          key: "check_in",
          label: "Personal wellbeing check-in",
          target: 1,
          unit: "check-in",
        },
      ],
      assumptions,
    };
  const maxDays =
    assessment.experience === "beginner"
      ? 3
      : assessment.experience === "intermediate"
      ? 4
      : 5;
  const selected = days.slice(0, maxDays);
  const workouts = selected.map((day, index) => {
    const easy = exercise(
      "Comfortable walk",
      1,
      undefined,
      "Walk at a pace where you can still talk. Begin gently and choose an even, comfortable surface.",
      ["Comfortable indoor walk", "Easy stationary cycling if familiar"],
      Math.max(60, minutes * 60 - preparationSeconds)
    );
    const reset = exercise(
      "Gentle mobility reset",
      1,
      undefined,
      "Move shoulders and ankles slowly within a comfortable range. Keep breathing and avoid forced stretches.",
      ["Seated shoulder and ankle movements"],
      preparationSeconds
    );
    const chair = exercise(
      "Chair sit-to-stand",
      sets,
      6,
      "Use a stable chair against a wall. With feet planted, stand and sit slowly within a comfortable range.",
      ["Assisted sit-to-stand with stable support"]
    );
    const push = exercise(
      "Wall push-up",
      sets,
      6,
      "Stand facing a wall with hands around shoulder height. Bend elbows gently toward the wall, then press back with control.",
      ["Wall press with a smaller range"]
    );
    const row = exercise(
      "Light resistance row",
      sets,
      8,
      "With familiar light equipment and a stable position, draw elbows back smoothly. Avoid jerking and keep breathing.",
      ["Unweighted shoulder-blade squeeze"]
    );
    const isStrength = strength || (!mobility && index % 2 === 1);
    const exercises = mobility
      ? [easy, reset]
      : isStrength
      ? [
          exercise(
            "Gentle warm-up",
            1,
            undefined,
            "Begin with an easy walk or comfortable marching to prepare for movement.",
            ["Seated marching"],
            preparationSeconds
          ),
          chair,
          push,
          ...(minutes >= 15 && /band|dumbbell|gym/.test(equipment)
            ? [row]
            : []),
          reset,
        ]
      : [easy, reset];
    return {
      day,
      name: mobility
        ? "Move & restore"
        : isStrength
        ? "Foundation strength"
        : "Comfortable movement",
      durationMinutes: minutes,
      exercises,
    };
  });
  return {
    name: strength
      ? "Your strength foundation"
      : mobility
      ? "Your movement & mobility starter"
      : "Your weekly wellness starter",
    description:
      "A flexible first week, shaped around your available days, equipment and experience. Adjust it with an approved professional.",
    requiresProfessionalReview: false,
    baselineTargets,
    workouts,
    nutrition: { guidance: nutrition, calories: baseline.calories },
    habits: [
      {
        key: "water",
        label: "Drinking-water check-in",
        target: baseline.waterMl ?? 2000,
        unit: "ml",
      },
      { key: "sleep", label: "Make time for sleep", target: 7, unit: "hours" },
      {
        key: "workout_consistency",
        label: "Planned movement days",
        target: selected.length,
        unit: "days/week",
      },
    ],
    assumptions,
  };
}

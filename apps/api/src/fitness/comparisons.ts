import type {
  FitnessDayComparison,
  FitnessDayTotals,
  FitnessLog,
  FitnessPlanContent,
  FitnessProfile,
  FitnessTargets,
  FitnessTargetRange,
  FitnessTargetComparison,
  FitnessTargetStatus,
  FitnessWeightSnapshot,
  FitnessWeightProgress,
  FitnessWorkoutComparison,
} from "@anticlock/contracts";
import { buildFitnessBaseline } from "./FitnessEngine.js";
import { fitnessDateInZone } from "./aggregates.js";
export type FitnessPlanTimelineEntry = {
  planId: string;
  status: string;
  planCreatedAt: string;
  version: number;
  versionCreatedAt: string;
  content: FitnessPlanContent;
};
const round = (n: number) => Math.round(n * 100) / 100;
const range = (n: number | null | undefined): FitnessTargetRange | null =>
  typeof n === "number" && Number.isFinite(n) && n >= 0
    ? { min: n, max: n }
    : null;
function validRange(
  value: FitnessTargetRange | null | undefined
): FitnessTargetRange | null {
  return value &&
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min >= 0 &&
    value.max >= value.min
    ? { min: value.min, max: value.max }
    : null;
}
export function fitnessProfileNeedsReview(
  profile: FitnessProfile | null,
  now = new Date()
): boolean {
  if (!profile || profile.status !== "complete" || !profile.baseline)
    return true;
  try {
    const assessment = { ...profile.assessment };
    // A passed optional goal deadline is a planning update, not a clinical risk.
    if (
      assessment.targetDate &&
      assessment.targetDate <=
        fitnessDateInZone(now, assessment.timezone ?? "Asia/Kolkata")
    )
      delete assessment.targetDate;
    return (
      profile.baseline.requiresProfessionalReview ||
      buildFitnessBaseline(assessment, now).requiresProfessionalReview
    );
  } catch {
    return true;
  }
}
export function fitnessTargetStatus(
  profile: FitnessProfile | null,
  plan: { status: string; content: FitnessPlanContent } | null,
  now = new Date()
): FitnessTargetStatus {
  if (!profile) return "unavailable";
  if (
    fitnessProfileNeedsReview(profile, now) ||
    plan?.status === "needs_review" ||
    plan?.content.requiresProfessionalReview
  )
    return "needs_review";
  if (!plan || plan.status !== "active") return "no_plan";
  return "available";
}
export function applicableFitnessPlan(
  history: FitnessPlanTimelineEntry[],
  date: string,
  timezone: string
): FitnessPlanTimelineEntry | null {
  return (
    history
      .filter(
        (row) =>
          row.status === "active" &&
          fitnessDateInZone(new Date(row.planCreatedAt), timezone) <= date &&
          fitnessDateInZone(new Date(row.versionCreatedAt), timezone) <= date
      )
      .sort(
        (a, b) =>
          a.versionCreatedAt.localeCompare(b.versionCreatedAt) ||
          a.version - b.version
      )
      .at(-1) ?? null
  );
}
function targetsFor(
  profile: FitnessProfile,
  plan: FitnessPlanTimelineEntry
): { targets: FitnessTargets; currentFallback: boolean } {
  const explicit = plan.content.nutrition.targets,
    snapshot = plan.content.baselineTargets,
    baseline = profile.baseline!;
  let currentFallback = false;
  const macro = (key: "proteinG" | "carbsG" | "fatG") => {
    if (explicit?.[key]) return validRange(explicit[key]);
    if (snapshot) return validRange(snapshot[key]);
    currentFallback = true;
    return validRange(baseline[key]);
  };
  const habit = (key: string, units: string[]) =>
    plan.content.habits.find(
      (h) =>
        h.key.toLowerCase().includes(key) &&
        units.includes(h.unit.toLowerCase()) &&
        Number.isFinite(h.target) &&
        h.target >= 0
    );
  const fibre = explicit?.fibreG
    ? validRange(explicit.fibreG)
    : snapshot
    ? range(snapshot.fibreG)
    : ((currentFallback = true), range(baseline.fibreG));
  const waterHabit = habit("water", ["ml"]);
  const water = explicit?.waterMl
    ? validRange(explicit.waterMl)
    : waterHabit
    ? range(waterHabit.target)
    : snapshot
    ? range(snapshot.waterMl)
    : ((currentFallback = true), range(baseline.waterMl));
  const steps = habit("steps", ["steps"]),
    sleep = habit("sleep", ["hours", "minutes", "min"]);
  return {
    targets: {
      calories: validRange(plan.content.nutrition.calories),
      proteinG: macro("proteinG"),
      carbsG: macro("carbsG"),
      fatG: macro("fatG"),
      fibreG: fibre,
      waterMl: water,
      steps: steps ? range(steps.target) : null,
      sleepMinutes: sleep
        ? range(sleep.target * (sleep.unit.toLowerCase() === "hours" ? 60 : 1))
        : null,
      habits: plan.content.habits,
    },
    currentFallback,
  };
}
export function currentFitnessTargets(
  profile: FitnessProfile | null,
  plan: FitnessPlanTimelineEntry | null,
  now = new Date()
): FitnessTargets | null {
  return fitnessTargetStatus(profile, plan, now) === "available" &&
    profile &&
    plan
    ? targetsFor(profile, plan).targets
    : null;
}
export function compareFitnessTarget(
  actual: number,
  target: FitnessTargetRange | null
): FitnessTargetComparison | null {
  if (!target) return null;
  return {
    actual: round(actual),
    targetMin: target.min,
    targetMax: target.max,
    percent: target.min > 0 ? round((actual / target.min) * 100) : null,
    inRange: actual >= target.min && actual <= target.max,
    relation:
      actual < target.min ? "below" : actual > target.max ? "above" : "within",
  };
}
export function fitnessWorkoutCompletion(
  plan: FitnessPlanTimelineEntry,
  date: string,
  logs: FitnessLog[],
  history: FitnessPlanTimelineEntry[],
  timezone: string
): FitnessWorkoutComparison {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(),
    scheduled = plan.content.workouts.filter((w) => w.day === day);
  if (!scheduled.length)
    return { planned: 0, completed: 0, completionPercent: null };
  const matched = new Set<string>();
  for (const log of logs) {
    if (log.kind !== "workout" || log.date !== date) continue;
    const data = log.data as {
      status: string;
      planId?: string;
      planDay?: number;
      planVersion?: number;
      name: string;
    };
    if (
      data.status !== "completed" ||
      data.planId !== plan.planId ||
      (data.planDay !== undefined && data.planDay !== day)
    )
      continue;
    const eligibleVersions = history.filter(
      (row) =>
        row.planId === plan.planId &&
        fitnessDateInZone(new Date(row.versionCreatedAt), timezone) <= date &&
        !row.content.requiresProfessionalReview
    );
    const reference = data.planVersion
      ? eligibleVersions.find((row) => row.version === data.planVersion)
      : eligibleVersions
          .filter((row) => row.versionCreatedAt <= log.createdAt)
          .sort(
            (a, b) =>
              a.versionCreatedAt.localeCompare(b.versionCreatedAt) ||
              a.version - b.version
          )
          .at(-1) ?? plan;
    const name = data.name.trim().toLowerCase();
    if (
      reference?.content.workouts.some(
        (w) => w.day === day && w.name.trim().toLowerCase() === name
      )
    )
      matched.add(name);
  }
  const completed = Math.min(scheduled.length, matched.size);
  return {
    planned: scheduled.length,
    completed,
    completionPercent: round((completed / scheduled.length) * 100),
  };
}
export function fitnessDayComparisons(
  profile: FitnessProfile | null,
  history: FitnessPlanTimelineEntry[],
  days: FitnessDayTotals[],
  logs: FitnessLog[],
  timezone: string,
  now = new Date()
): FitnessDayComparison[] {
  const today = fitnessDateInZone(now, timezone),
    review = fitnessProfileNeedsReview(profile, now);
  return days.map((day) => {
    const plan =
      day.date <= today
        ? applicableFitnessPlan(history, day.date, timezone)
        : null;
    const available =
      !!profile &&
      !!plan &&
      !review &&
      !plan.content.requiresProfessionalReview;
    const resolved = available ? targetsFor(profile!, plan!) : null;
    const targets = resolved?.targets ?? null,
      kinds = day.recordedKinds ?? [];
    return {
      date: day.date,
      planId: plan?.planId ?? null,
      version: plan?.version ?? null,
      basis: resolved
        ? resolved.currentFallback
          ? "current_targets"
          : "saved_plan_version"
        : "unavailable",
      targets,
      nutrition:
        targets && kinds.includes("meal")
          ? {
              calories: compareFitnessTarget(
                day.nutrients.calories,
                targets.calories
              ),
              proteinG: compareFitnessTarget(
                day.nutrients.proteinG,
                targets.proteinG
              ),
              carbsG: compareFitnessTarget(
                day.nutrients.carbsG,
                targets.carbsG
              ),
              fatG: compareFitnessTarget(day.nutrients.fatG, targets.fatG),
              fibreG: compareFitnessTarget(
                day.nutrients.fibreG,
                targets.fibreG
              ),
            }
          : null,
      water:
        targets && kinds.includes("water")
          ? compareFitnessTarget(day.waterMl, targets.waterMl)
          : null,
      steps:
        targets && kinds.includes("steps")
          ? compareFitnessTarget(day.steps, targets.steps)
          : null,
      sleep:
        targets && kinds.includes("sleep")
          ? compareFitnessTarget(day.sleepMinutes, targets.sleepMinutes)
          : null,
      workout: available
        ? fitnessWorkoutCompletion(plan!, day.date, logs, history, timezone)
        : null,
    };
  });
}
export function summarizeFitnessComparisons(
  comparisons: FitnessDayComparison[],
  days: FitnessDayTotals[]
) {
  const due = comparisons.filter((day) => (day.workout?.planned ?? 0) > 0),
    plannedWorkouts = due.reduce((n, d) => n + d.workout!.planned, 0),
    completedPlannedWorkouts = due.reduce(
      (n, d) => n + d.workout!.completed,
      0
    ),
    calories = comparisons.flatMap((day) =>
      day.nutrition?.calories ? [day.nutrition.calories] : []
    ),
    inRange = calories.filter((v) => v.inRange).length;
  return {
    weekly: {
      plannedDays: due.length,
      completedPlannedDays: due.filter((day) => day.workout!.completed > 0)
        .length,
      plannedWorkouts,
      completedPlannedWorkouts,
      completionPercent: plannedWorkouts
        ? round((completedPlannedWorkouts / plannedWorkouts) * 100)
        : null,
      consistencyPercent: due.length
        ? round(
            (due.filter((day) => day.workout!.completed > 0).length /
              due.length) *
              100
          )
        : null,
      dueDates: due.map((day) => day.date),
    },
    adherence: {
      recordedDays: days.filter((d) => d.recordedKinds?.length).length,
      nutritionRecordedDays: calories.length,
      nutritionInRangeDays: inRange,
      nutritionInRangePercent: calories.length
        ? round((inRange / calories.length) * 100)
        : null,
      plannedWorkouts,
      completedPlannedWorkouts,
      completionPercent: plannedWorkouts
        ? round((completedPlannedWorkouts / plannedWorkouts) * 100)
        : null,
    },
  };
}
export function fitnessWeightSnapshots(
  profile: FitnessProfile | null,
  weights: FitnessLog[],
  asOf: string,
  timezone: string,
  allowTarget: boolean
): {
  latestWeight: FitnessWeightSnapshot | null;
  weightProgress: FitnessWeightProgress | null;
} {
  const measurement = weights
    .filter((log) => log.kind === "weight" && log.date <= asOf)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    )
    .at(-1);
  const knownStart = profile?.assessmentStart;
  const startWeight = knownStart?.weightKg ?? profile?.assessment.weightKg;
  const startDate =
    knownStart?.date ??
    (profile
      ? fitnessDateInZone(
          new Date(profile.completedAt ?? profile.createdAt),
          timezone
        )
      : null);
  const fallback: FitnessWeightSnapshot | null =
    typeof startWeight === "number" && startDate && startDate <= asOf
      ? { weightKg: startWeight, date: startDate, source: "assessment" }
      : null;
  const latestWeight: FitnessWeightSnapshot | null = measurement
    ? {
        weightKg: (measurement.data as { weightKg: number }).weightKg,
        date: measurement.date,
        source: "measurement",
      }
    : fallback;
  if (!profile || !fallback || startWeight === undefined || !startDate)
    return { latestWeight, weightProgress: null };
  const current =
    measurement && measurement.date >= startDate
      ? {
          weightKg: (measurement.data as { weightKg: number }).weightKg,
          date: measurement.date,
          source: "measurement" as const,
        }
      : fallback;
  const target = allowTarget ? profile.assessment.targetWeightKg ?? null : null;
  const denominator = target === null ? 0 : target - startWeight;
  return {
    latestWeight,
    weightProgress: {
      startWeightKg: startWeight,
      currentWeightKg: current.weightKg,
      targetWeightKg: target,
      changeKg: round(current.weightKg - startWeight),
      remainingKg:
        target === null ? null : round(Math.abs(target - current.weightKg)),
      progressPercent:
        current.source === "measurement" && target !== null && denominator !== 0
          ? round(
              Math.max(
                0,
                Math.min(
                  100,
                  ((current.weightKg - startWeight) / denominator) * 100
                )
              )
            )
          : null,
      source: current.source,
      date: current.date,
      startDate,
      startSource: knownStart ? "initial_assessment" : "current_assessment",
    },
  };
}
export const FITNESS_TARGET_BASIS_NOTICE =
  "Daily comparisons use the latest saved version available on each date. Changes within a day may affect the comparison. Older versions without a baseline snapshot are explicitly compared with current targets. Missing logs are not counted as recorded zeroes or dietary adherence.";

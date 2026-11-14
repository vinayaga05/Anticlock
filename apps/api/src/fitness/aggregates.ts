import {
  FitnessDateSchema,
  type FitnessDayTotals,
  type FitnessLog,
  type FitnessNutrients,
  type FitnessProgress,
} from "@anticlock/contracts";
import { ApiError } from "../lib/httpError.js";

export const emptyNutrients = (): FitnessNutrients => ({
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fibreG: 0,
});
export function addNutrients(
  target: FitnessNutrients,
  value: FitnessNutrients,
  multiplier = 1
): void {
  for (const key of Object.keys(target) as Array<keyof FitnessNutrients>)
    target[key] += value[key] * multiplier;
}
export function shiftFitnessDate(date: string, days: number): string {
  const value = new Date(`${FitnessDateSchema.parse(date)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function fitnessDateInZone(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    return `${parts.find((p) => p.type === "year")!.value}-${
      parts.find((p) => p.type === "month")!.value
    }-${parts.find((p) => p.type === "day")!.value}`;
  } catch {
    throw new ApiError(400, "invalid_timezone", "Use a valid IANA timezone.");
  }
}
export function validateFitnessRange(from: string, to: string): void {
  FitnessDateSchema.parse(from);
  FitnessDateSchema.parse(to);
  const days =
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
    86400000;
  if (days < 0 || days > 365)
    throw new ApiError(
      400,
      "invalid_range",
      "Choose a date range of at most 366 days."
    );
}
export function aggregateFitnessDays(
  logs: FitnessLog[],
  from: string,
  to: string
): FitnessDayTotals[] {
  validateFitnessRange(from, to);
  const map = new Map<string, FitnessDayTotals>();
  for (let date = from; date <= to; date = shiftFitnessDate(date, 1))
    map.set(date, {
      date,
      workouts: 0,
      workoutMinutes: 0,
      nutrients: emptyNutrients(),
      waterMl: 0,
      steps: 0,
      sleepMinutes: 0,
      habitsCompleted: 0,
      weightKg: null,
      active: false,
      recordedKinds: [],
    });
  const ordered = [...logs].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
  const habits = new Map<string, boolean>();
  for (const log of ordered) {
    const day = map.get(log.date);
    if (!day) continue;
    if (!day.recordedKinds!.includes(log.kind))
      day.recordedKinds!.push(log.kind);
    switch (log.kind) {
      case "workout": {
        const data = log.data as Extract<
          FitnessLog["data"],
          { status: unknown }
        >;
        if (data.status === "completed") {
          day.workouts++;
          day.workoutMinutes += data.durationMinutes ?? 0;
          day.active = true;
        }
        break;
      }
      case "meal": {
        const data = log.data as Extract<
          FitnessLog["data"],
          { mealType: unknown }
        >;
        for (const food of data.foods)
          addNutrients(day.nutrients, food.nutrients, food.servings);
        break;
      }
      case "water":
        day.waterMl += (log.data as { amountMl: number }).amountMl;
        break;
      case "steps":
        day.steps += (log.data as { count: number }).count;
        if ((log.data as { count: number }).count > 0) day.active = true;
        break;
      case "sleep":
        day.sleepMinutes += (
          log.data as { durationMinutes: number }
        ).durationMinutes;
        break;
      case "habit": {
        const data = log.data as { key: string; completed: boolean };
        habits.set(`${log.date}:${data.key}`, data.completed);
        break;
      }
      case "weight":
        day.weightKg = (log.data as { weightKg: number }).weightKg;
        break;
    }
  }
  for (const [key, complete] of habits) {
    if (complete) {
      const day = map.get(key.slice(0, 10))!;
      day.habitsCompleted++;
      day.active = true;
    }
  }
  return [...map.values()];
}
export function fitnessStreak(
  days: FitnessDayTotals[],
  allowPendingDay = true
): number {
  // A day in progress does not break yesterday's established streak.
  let end = days.length - 1;
  if (allowPendingDay && end >= 0 && !days[end]!.active) end--;
  let count = 0;
  for (let i = end; i >= 0 && days[i]!.active; i--) count++;
  return count;
}
export function calculateFitnessProgress(
  logs: FitnessLog[],
  from: string,
  to: string,
  timezone: string,
  now = new Date()
): FitnessProgress {
  const allowPendingDay = to === fitnessDateInZone(now, timezone);
  const days = aggregateFitnessDays(logs, from, to);
  const totals = {
    workouts: 0,
    workoutMinutes: 0,
    activeDays: 0,
    waterMl: 0,
    steps: 0,
    sleepMinutes: 0,
    habitsCompleted: 0,
    nutrients: emptyNutrients(),
  };
  for (const day of days) {
    totals.workouts += day.workouts;
    totals.workoutMinutes += day.workoutMinutes;
    totals.activeDays += Number(day.active);
    totals.waterMl += day.waterMl;
    totals.steps += day.steps;
    totals.sleepMinutes += day.sleepMinutes;
    totals.habitsCompleted += day.habitsCompleted;
    addNutrients(totals.nutrients, day.nutrients);
  }
  const weights = days.flatMap((day) =>
    day.weightKg === null ? [] : [day.weightKg]
  );
  const strength = new Map<
    string,
    { exercise: string; maxWeightKg: number; totalReps: number }
  >();
  const strengthSeries = new Map<
    string,
    Map<string, { date: string; maxWeightKg: number; totalReps: number }>
  >();
  for (const log of logs) {
    if (log.kind !== "workout" || log.date < from || log.date > to) continue;
    const data = log.data as Extract<FitnessLog["data"], { status: unknown }>;
    if (data.status !== "completed") continue;
    for (const exercise of data.exercises) {
      const key = exercise.name.toLowerCase();
      const entry = strength.get(key) ?? {
        exercise: exercise.name,
        maxWeightKg: 0,
        totalReps: 0,
      };
      for (const set of exercise.sets) {
        entry.maxWeightKg = Math.max(entry.maxWeightKg, set.weightKg ?? 0);
        entry.totalReps += set.reps ?? 0;
        if (typeof set.weightKg === "number" && set.weightKg > 0) {
          const series =
            strengthSeries.get(key) ??
            new Map<
              string,
              { date: string; maxWeightKg: number; totalReps: number }
            >();
          const dated = series.get(log.date) ?? {
            date: log.date,
            maxWeightKg: 0,
            totalReps: 0,
          };
          dated.maxWeightKg = Math.max(dated.maxWeightKg, set.weightKg);
          dated.totalReps += set.reps ?? 0;
          series.set(log.date, dated);
          strengthSeries.set(key, series);
        }
      }
      strength.set(key, entry);
    }
  }
  const loggedDays = new Set(
    logs
      .filter((log) => log.date >= from && log.date <= to)
      .map((log) => log.date)
  ).size;
  let longestStreak = 0,
    runningStreak = 0;
  for (const day of days) {
    runningStreak = day.active ? runningStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, runningStreak);
  }
  return {
    currentStreak: fitnessStreak(days, allowPendingDay),
    longestStreak,
    from,
    to,
    timezone,
    days,
    totals,
    streak: fitnessStreak(days, allowPendingDay),
    weightChangeKg:
      weights.length >= 2
        ? Math.round((weights.at(-1)! - weights[0]!) * 100) / 100
        : null,
    strength: [...strength.entries()].map(([key, row]) => {
      const series = [...(strengthSeries.get(key)?.values() ?? [])].sort(
        (a, b) => a.date.localeCompare(b.date)
      );
      return {
        ...row,
        series,
        hasRecordedLoad: series.length > 0,
        weightChangeKg:
          series.length >= 2
            ? Math.round(
                (series.at(-1)!.maxWeightKg - series[0]!.maxWeightKg) * 100
              ) / 100
            : null,
      };
    }),
    insights: loggedDays
      ? [
          `You saved records on ${loggedDays} ${
            loggedDays === 1 ? "day" : "days"
          } in this period.`,
          ...(totals.workouts
            ? [
                `${totals.workouts} completed ${
                  totals.workouts === 1 ? "workout" : "workouts"
                } recorded.`,
              ]
            : []),
        ]
      : [],
  };
}

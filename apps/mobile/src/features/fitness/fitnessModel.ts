import type {
  FitnessAssessment,
  FitnessDayTotals,
  FitnessLog,
  FitnessLogKind,
} from '@anticlock/contracts';

export const FITNESS_REVIEW_GUIDANCE =
  'Professional review is required before following exercise or nutrition targets. For medical conditions, injury, pregnancy or rehabilitation, seek an appropriately qualified healthcare professional. A plan revision or feedback alone is not medical clearance.';

export function localFitnessDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`;
}
export function fitnessTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
export function fitnessDateValid(value: string): boolean {
  const d = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}
export function fitnessAge(
  dob?: string,
  today = localFitnessDate(),
): number | null {
  if (!dob || !fitnessDateValid(dob) || dob > today) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}
export function fitnessRange(
  period: 'week' | 'month',
  end = localFitnessDate(),
) {
  const start = new Date(`${end}T12:00:00`);
  start.setDate(start.getDate() - (period === 'week' ? 6 : 29));
  return { from: localFitnessDate(start), to: end };
}
export function assessmentMissing(a: FitnessAssessment): string | null {
  const age = fitnessAge(a.dateOfBirth);
  if (age === null || age > 120) return 'Enter your valid date of birth.';
  if (!a.heightCm || a.heightCm < 50 || a.heightCm > 260)
    return 'Height must be between 50 and 260 cm.';
  if (!a.weightKg || a.weightKg < 15 || a.weightKg > 500)
    return 'Weight must be between 15 and 500 kg.';
  if (!a.goals?.length) return 'Choose at least one goal.';
  if (!a.activityLevel || !a.experience)
    return 'Choose your activity level and experience.';
  if (!a.availableDays?.length)
    return 'Choose at least one day that suits your routine.';
  if (!a.foodPreferences?.length)
    return 'Choose your food preference, including no preference.';
  if (!a.disclaimerAccepted)
    return 'Read and accept the wellness guidance to continue.';
  return null;
}
export function numberLabel(
  value: number | null | undefined,
  suffix = '',
): string {
  return value === null || value === undefined
    ? '—'
    : `${Math.round(value * 10) / 10}${suffix}`;
}
export function logTitle(log: FitnessLog): string {
  const d = log.data as any;
  switch (log.kind) {
    case 'workout':
      return `${d.name} · ${d.status.replace(/_/g, ' ')}`;
    case 'meal':
      return `${d.mealType} · ${d.foods
        .map((food: any) => food.name)
        .join(', ')}`;
    case 'water':
      return `${d.amountMl} ml water`;
    case 'sleep':
      return `${numberLabel(d.durationMinutes / 60)} hours sleep`;
    case 'steps':
      return `${d.count} steps`;
    case 'weight':
      return `${d.weightKg} kg`;
    default:
      return `${d.key} · ${d.completed ? 'done' : 'not done'}`;
  }
}
export const logKinds: FitnessLogKind[] = [
  'workout',
  'meal',
  'water',
  'habit',
  'sleep',
  'steps',
  'weight',
];
export const nutrientKeys = [
  'calories',
  'proteinG',
  'carbsG',
  'fatG',
  'fibreG',
] as const;
export const emptyNutrients = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fibreG: 0,
};
export function chartPoints(
  values: Array<number | null>,
  width = 280,
  height = 100,
): string {
  return chartSegments(values, width, height).join(' ');
}
export function chartSegments(
  values: Array<number | null>,
  width = 280,
  height = 100,
): string[] {
  const valid = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!valid.length) return [];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || 1;
  const segments: string[] = [];
  let points: string[] = [];
  values.forEach((v, index) => {
    if (v === null || !Number.isFinite(v)) {
      if (points.length) segments.push(points.join(' '));
      points = [];
      return;
    }
    points.push(
      `${12 + (index * (width - 24)) / Math.max(values.length - 1, 1)},${
        height - 12 - ((v - min) / span) * (height - 24)
      }`,
    );
  });
  if (points.length) segments.push(points.join(' '));
  return segments;
}
export function dayMetric(
  day: FitnessDayTotals,
  metric: string,
): number | null {
  const metricKinds: Partial<Record<string, FitnessLogKind>> = {
    weightKg: 'weight',
    workouts: 'workout',
    workoutMinutes: 'workout',
    calories: 'meal',
    proteinG: 'meal',
    carbsG: 'meal',
    fatG: 'meal',
    fibreG: 'meal',
    waterMl: 'water',
    sleepMinutes: 'sleep',
    steps: 'steps',
    habitsCompleted: 'habit',
  };
  const kind = metricKinds[metric];
  if (day.recordedKinds && kind && !day.recordedKinds.includes(kind))
    return null;
  if (metric === 'weightKg') return day.weightKg;
  if (nutrientKeys.includes(metric as any))
    return day.nutrients[metric as keyof typeof day.nutrients];
  return Number((day as any)[metric] ?? 0);
}

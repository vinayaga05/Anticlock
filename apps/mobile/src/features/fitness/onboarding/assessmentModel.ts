import type {
  FitnessAssessment,
  FitnessAssessmentPatch,
} from '@anticlock/contracts';
import { fitnessAge, fitnessTimezone } from '../fitnessModel';

export const ASSESSMENT_STEPS = [
  'Your goal',
  'Basic details',
  'Your routine',
  'Food preferences',
  'Ready for your plan',
] as const;
export const PRIMARY_GOALS = [
  { value: 'weight_loss', label: 'Lose Weight' },
  { value: 'muscle_gain', label: 'Build Muscle' },
  { value: 'fitness', label: 'Stay Fit' },
  { value: 'strength', label: 'Improve Strength' },
  { value: 'flexibility', label: 'Improve Flexibility' },
  { value: 'balanced_nutrition', label: 'Eat Healthier' },
] as const;
export const FOOD_OPTIONS = [
  'vegetarian',
  'vegan',
  'eggetarian',
  'non_vegetarian',
  'other',
] as const;
export const LOCATION_OPTIONS = ['home', 'gym', 'outdoor', 'any'] as const;
const locationTokens = LOCATION_OPTIONS.map(value => `location:${value}`);
export const POUNDS_PER_KG = 2.2046226218;

export function initialAssessment(): FitnessAssessment {
  return {
    units: 'metric',
    calculationSex: 'unspecified',
    equipment: [],
    timezone: fitnessTimezone(),
  };
}
export function humanAssessmentValue(value: string) {
  const labels: Record<string, string> = {
    general_wellness: 'General wellbeing',
    maintenance: 'Maintain my rhythm',
    endurance: 'Endurance',
    mobility: 'Mobility',
    weight_management: 'Weight management',
    better_sleep: 'Better sleep',
    rehabilitation_support: 'Rehabilitation support',
    no_preference: 'No preference',
    non_vegetarian: 'Non-vegetarian',
    eggetarian: 'Eggetarian',
    other: 'Other',
    moderate: 'Active',
    sedentary: 'Mostly sitting',
    light: 'Lightly active',
    active: 'Active',
    very_active: 'Very active',
  };
  return (
    PRIMARY_GOALS.find(goal => goal.value === value)?.label ??
    labels[value] ??
    value.replace(/_/g, ' ').replace(/^./, first => first.toUpperCase())
  );
}
export function replaceKnownChoices(
  existing: string[] | undefined,
  known: readonly string[],
  selected: string[],
): string[] {
  const keys = new Set(known.map(value => value.toLowerCase()));
  return [
    ...new Set([
      ...(existing ?? []).filter(value => !keys.has(value.toLowerCase())),
      ...selected,
    ]),
  ];
}
export function selectedKnownChoices(
  existing: string[] | undefined,
  known: readonly string[],
): string[] {
  return known.filter(value =>
    existing?.some(item => item.toLowerCase() === value.toLowerCase()),
  );
}
export function workoutLocation(
  preferences: string[] | undefined,
): string | undefined {
  return preferences
    ?.find(value => locationTokens.includes(value))
    ?.slice('location:'.length);
}
export function setWorkoutLocation(
  preferences: string[] | undefined,
  location: string | undefined,
): string[] {
  return [
    ...(preferences ?? []).filter(value => !locationTokens.includes(value)),
    ...(location && (LOCATION_OPTIONS as readonly string[]).includes(location)
      ? [`location:${location}`]
      : []),
  ];
}
export function formatHeightInches(value: number) {
  const inches = Math.round(value * 10) / 10;
  return `${Math.floor(inches / 12)} ft ${
    Math.round((inches % 12) * 10) / 10
  } in`;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}
export function assessmentValueKey(value: unknown): string {
  return JSON.stringify(canonical(value)) ?? 'undefined';
}
export function assessmentsEqual(a: FitnessAssessment, b: FitnessAssessment) {
  return assessmentValueKey(a) === assessmentValueKey(b);
}
export function assessmentPatch(
  saved: FitnessAssessment,
  current: FitnessAssessment,
): FitnessAssessmentPatch {
  const patch: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(saved), ...Object.keys(current)])) {
    const name = key as keyof FitnessAssessment;
    if (assessmentValueKey(saved[name]) !== assessmentValueKey(current[name]))
      patch[key] = current[name] === undefined ? null : current[name];
  }
  return patch as FitnessAssessmentPatch;
}
export function assessmentStepError(
  step: number,
  draft: FitnessAssessment,
): string | null {
  if (step === 0 && !draft.goals?.length) return 'Choose at least one goal.';
  if (step === 1) {
    const age = fitnessAge(draft.dateOfBirth);
    if (age === null || age > 120) return 'Choose your date of birth.';
    if (
      !Number.isFinite(draft.heightCm) ||
      !draft.heightCm ||
      draft.heightCm < 50 ||
      draft.heightCm > 260
    )
      return 'Add your height.';
    if (
      !Number.isFinite(draft.weightKg) ||
      !draft.weightKg ||
      draft.weightKg < 15 ||
      draft.weightKg > 500
    )
      return 'Add your current weight.';
  }
  if (step === 2) {
    if (!draft.activityLevel) return 'Choose your usual activity level.';
    if (!draft.experience) return 'Choose your fitness experience.';
    if (!draft.availableDays?.length)
      return 'Choose at least one day that works for you.';
  }
  if (step === 3 && !draft.foodPreferences?.length)
    return 'Choose a food preference, including Other.';
  if (step === 4 && !draft.disclaimerAccepted)
    return 'Please accept the wellness guidance.';
  return null;
}

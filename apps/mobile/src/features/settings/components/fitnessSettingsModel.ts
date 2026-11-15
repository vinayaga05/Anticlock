import type { FitnessLogKind, FitnessSummary } from '@anticlock/contracts';
import {
  dayMetric,
  fitnessDateValid,
  numberLabel,
} from '../../fitness/fitnessModel';

export type FitnessSettingsModel = {
  focus: string;
  focusNote?: string;
  exercises: { name: string; detail: string }[];
  workoutEmpty: string;
  stats: { label: string; value: string }[];
  chestFocus: boolean;
};
const unknownStats = () => [
  { label: 'Movement', value: '—' },
  { label: 'Workouts · week', value: '—' },
  { label: 'Current streak', value: '—' },
  { label: 'Sleep', value: '—' },
];
const validNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = (value: unknown) =>
  validNumber(value) ? numberLabel(value) : '—';

/** Presentation only: uses saved schedules and recorded totals, with no health estimates. */
export function buildFitnessSettingsModel(
  summary: FitnessSummary | undefined,
  expectedDate: string,
): FitnessSettingsModel {
  const model: FitnessSettingsModel = {
    focus: 'Set up private Fitness',
    focusNote: 'Your saved plan and daily entries appear here.',
    exercises: [],
    workoutEmpty: 'Set up your private Fitness space to get started.',
    stats: unknownStats(),
    chestFocus: false,
  };
  if (!summary) return model;
  if (
    !fitnessDateValid(expectedDate) ||
    summary.date !== expectedDate ||
    summary.today.date !== expectedDate
  ) {
    return {
      ...model,
      focus: 'Open today’s Fitness',
      focusNote: 'Refresh your saved plan and entries for today.',
      workoutEmpty: 'Today’s saved workout is not loaded yet.',
    };
  }

  // Older responses omit recordedKinds. Only real same-date log rows can supply
  // that evidence; the legacy aggregate's default zero alone is insufficient.
  const recordedKinds: FitnessLogKind[] = summary.today.recordedKinds ?? [
    ...new Set(
      summary.logs
        .filter(log => log.date === expectedDate)
        .map(log => log.kind),
    ),
  ];
  const day = { ...summary.today, recordedKinds };
  const movement = dayMetric(day, 'workoutMinutes');
  const sleep = dayMetric(day, 'sleepMinutes');
  const { profile, plan } = summary;
  const reviewRequired = Boolean(
    profile?.baseline?.requiresProfessionalReview ||
      plan?.content.requiresProfessionalReview ||
      plan?.status === 'needs_review' ||
      summary.targetStatus === 'needs_review',
  );
  const comparisonAvailable =
    profile?.status === 'complete' &&
    plan?.status === 'active' &&
    summary.targetStatus !== 'no_plan' &&
    !reviewRequired;
  const scheduled =
    comparisonAvailable &&
    validNumber(summary.weekly.completedPlannedWorkouts) &&
    validNumber(summary.weekly.plannedWorkouts);
  const streak = summary.weekly.streak;
  const sleepMinutes = validNumber(sleep) ? Math.round(sleep) : null;
  model.stats = [
    {
      label: 'Movement',
      value: validNumber(movement) ? `${numberLabel(movement)} min` : '—',
    },
    {
      label: scheduled ? 'Due workouts · week' : 'Workouts · week',
      value: scheduled
        ? `${count(summary.weekly.completedPlannedWorkouts)}/${count(
            summary.weekly.plannedWorkouts,
          )}`
        : count(summary.weekly.workouts),
    },
    {
      label: 'Current streak',
      value: validNumber(streak)
        ? `${numberLabel(streak)} ${streak === 1 ? 'day' : 'days'}`
        : '—',
    },
    {
      label: 'Sleep',
      value:
        sleepMinutes === null
          ? '—'
          : `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m`,
    },
  ];

  if (!profile || profile.status !== 'complete') {
    model.focusNote = 'Complete your assessment to create a saved plan.';
    model.workoutEmpty = 'Your exercises will appear after setup.';
    return model;
  }
  if (reviewRequired) {
    return {
      ...model,
      focus: 'Review your plan',
      focusNote: 'Open Fitness before following exercise guidance.',
      workoutEmpty: 'Exercise guidance is withheld until review.',
    };
  }
  if (!plan || summary.targetStatus === 'no_plan') {
    return {
      ...model,
      focus: 'Create your plan',
      focusNote: 'Choose a saved routine for your goals.',
      workoutEmpty: 'Your exercises will appear when you create a plan.',
    };
  }
  if (plan.status !== 'active') {
    return {
      ...model,
      focus: 'Your plan is not ready',
      focusNote: 'Open Fitness to check your saved plan.',
      workoutEmpty: 'Your exercises will appear when your plan is ready.',
    };
  }
  const weekday = new Date(`${expectedDate}T12:00:00Z`).getUTCDay();
  const workout = plan.content.workouts.find(item => item.day === weekday);
  if (!workout) {
    return {
      ...model,
      focus: 'Rest day',
      focusNote: 'No workout is scheduled in your saved plan today.',
      workoutEmpty: 'No planned exercises today.',
    };
  }
  model.focus = workout.name.trim() || 'Open your saved workout';
  model.focusNote = validNumber(workout.durationMinutes)
    ? `${numberLabel(workout.durationMinutes)} min · Saved workout`
    : 'Saved workout';
  model.workoutEmpty = 'No exercises are listed in this saved workout.';
  model.chestFocus = /\b(?:chest|pectorals?)\b/i.test(workout.name);
  model.exercises = workout.exercises.slice(0, 2).map(exercise => {
    const sets = validNumber(exercise.sets)
      ? `${numberLabel(exercise.sets)} ${exercise.sets === 1 ? 'set' : 'sets'}`
      : '';
    const reps = validNumber(exercise.reps)
      ? `${numberLabel(exercise.reps)} ${exercise.reps === 1 ? 'rep' : 'reps'}`
      : '';
    const duration = validNumber(exercise.durationSeconds)
      ? `${numberLabel(exercise.durationSeconds)} sec`
      : '';
    const repetitions = [sets, reps].filter(Boolean).join(' × ');
    return {
      name: exercise.name,
      detail:
        [repetitions, duration].filter(Boolean).join(' · ') ||
        'Follow your saved instructions',
    };
  });
  return model;
}

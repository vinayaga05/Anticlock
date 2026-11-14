import type { FitnessPlanContent } from '@anticlock/contracts';

type PlannedWorkout = FitnessPlanContent['workouts'][number];
export type ExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  durationSeconds: string;
  restSeconds: string;
  instructions: string;
  substitutions: string;
  notes: string;
  mediaId?: string;
};
export type WorkoutDraft = {
  day: number;
  name: string;
  durationMinutes: string;
  exercises: ExerciseDraft[];
};
export const emptyExercise = (): ExerciseDraft => ({
  name: '',
  sets: '1',
  reps: '',
  durationSeconds: '',
  restSeconds: '60',
  instructions: '',
  substitutions: '',
  notes: '',
});
export const emptyWorkout = (day: number): WorkoutDraft => ({
  day,
  name: '',
  durationMinutes: '',
  exercises: [],
});
export function workoutDrafts(workouts: PlannedWorkout[]): WorkoutDraft[] {
  return workouts.map(day => ({
    day: day.day,
    name: day.name,
    durationMinutes: String(day.durationMinutes),
    exercises: day.exercises.map(exercise => ({
      name: exercise.name,
      sets: String(exercise.sets),
      reps: exercise.reps === undefined ? '' : String(exercise.reps),
      durationSeconds:
        exercise.durationSeconds === undefined
          ? ''
          : String(exercise.durationSeconds),
      restSeconds:
        exercise.restSeconds === undefined ? '' : String(exercise.restSeconds),
      instructions: exercise.instructions ?? '',
      substitutions: exercise.substitutions?.join('\n') ?? '',
      notes: exercise.notes ?? '',
      ...(exercise.mediaId ? { mediaId: exercise.mediaId } : {}),
    })),
  }));
}
/** Update one selected workout, preserving every other saved workout and its exercises. */
export function updateWorkoutDay(
  drafts: WorkoutDraft[],
  day: number,
  change: (draft: WorkoutDraft) => WorkoutDraft,
): WorkoutDraft[] {
  const index = drafts.findIndex(workout => workout.day === day);
  if (index < 0) return [...drafts, change(emptyWorkout(day))];
  return drafts.map((draft, i) => (i === index ? change(draft) : draft));
}
export function savedWorkouts(drafts: WorkoutDraft[]): PlannedWorkout[] {
  return drafts
    .map(day => ({
      day: day.day,
      name: day.name.trim(),
      durationMinutes: Number(day.durationMinutes),
      exercises: day.exercises.map(exercise => ({
        name: exercise.name.trim(),
        sets: Number(exercise.sets),
        ...(exercise.reps.trim() ? { reps: Number(exercise.reps) } : {}),
        ...(exercise.durationSeconds.trim()
          ? { durationSeconds: Number(exercise.durationSeconds) }
          : {}),
        ...(exercise.restSeconds.trim()
          ? { restSeconds: Number(exercise.restSeconds) }
          : {}),
        ...(exercise.instructions.trim()
          ? { instructions: exercise.instructions.trim() }
          : {}),
        ...(exercise.substitutions.trim()
          ? {
              substitutions: exercise.substitutions
                .split('\n')
                .map(value => value.trim())
                .filter(Boolean),
            }
          : {}),
        ...(exercise.notes.trim() ? { notes: exercise.notes.trim() } : {}),
        ...(exercise.mediaId ? { mediaId: exercise.mediaId } : {}),
      })),
    }))
    .sort((a, b) => a.day - b.day);
}

/** Client checks keep an incomplete form in place; the server remains authoritative. */
export function validRevisionDraft(
  value: import('@anticlock/contracts').FitnessPlanRevision,
): boolean {
  const finite = (number: number, min: number, max: number, integer = false) =>
    Number.isFinite(number) &&
    number >= min &&
    number <= max &&
    (!integer || Number.isInteger(number));
  if (
    value.note.trim().length < 3 ||
    value.note.length > 4000 ||
    (value.title !== undefined &&
      (value.title.length < 2 || value.title.length > 160))
  )
    return false;
  if (
    value.workouts &&
    !value.workouts.every(
      workout =>
        workout.name.trim().length > 0 &&
        workout.name.length <= 160 &&
        finite(workout.durationMinutes, 1, 180, true) &&
        workout.exercises.length > 0 &&
        workout.exercises.length <= 30 &&
        workout.exercises.every(
          exercise =>
            exercise.name.trim().length > 0 &&
            exercise.name.length <= 150 &&
            finite(exercise.sets, 1, 20, true) &&
            (exercise.reps === undefined ||
              finite(exercise.reps, 1, 100, true)) &&
            (exercise.durationSeconds === undefined ||
              finite(exercise.durationSeconds, 1, 7200, true)) &&
            (exercise.restSeconds === undefined ||
              finite(exercise.restSeconds, 0, 600, true)) &&
            (exercise.instructions?.length ?? 0) <= 3000 &&
            (exercise.notes?.length ?? 0) <= 1000 &&
            (exercise.substitutions?.length ?? 0) <= 10 &&
            (exercise.substitutions ?? []).every(
              text => text.length > 0 && text.length <= 150,
            ),
        ),
    )
  )
    return false;
  if (value.nutrition) {
    const nutrition = value.nutrition;
    if (
      !nutrition.guidance.length ||
      nutrition.guidance.some(line => !line.trim() || line.length > 1000)
    )
      return false;
    if (
      nutrition.calories &&
      (!finite(nutrition.calories.min, 1200, 5000, true) ||
        !finite(nutrition.calories.max, 1200, 5000, true) ||
        nutrition.calories.min > nutrition.calories.max)
    )
      return false;
    const bounds = {
      proteinG: [0, 250],
      carbsG: [0, 800],
      fatG: [0, 200],
      fibreG: [0, 70],
      waterMl: [500, 5000],
    };
    for (const [key, range] of Object.entries(nutrition.targets ?? {})) {
      const [min, max] = bounds[key as keyof typeof bounds];
      if (
        range &&
        (!finite(range.min, min, max) ||
          !finite(range.max, min, max) ||
          range.min > range.max)
      )
        return false;
    }
  }
  if (
    value.habits &&
    !value.habits.every(
      habit =>
        finite(habit.target, 0, 30000) &&
        (habit.key.includes('water')
          ? habit.unit === 'ml' && finite(habit.target, 500, 5000)
          : habit.key.includes('sleep')
          ? habit.unit === 'hours' && finite(habit.target, 4, 12)
          : true),
    )
  )
    return false;
  return true;
}

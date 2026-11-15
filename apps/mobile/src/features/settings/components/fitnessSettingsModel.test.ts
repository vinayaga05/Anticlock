import type { FitnessSummary } from '@anticlock/contracts';
import { buildFitnessSettingsModel } from './fitnessSettingsModel';
const date = '2026-11-15'; // Sunday, independent of device timezone.
function fixture(): FitnessSummary {
  return {
    date,
    timezone: 'Asia/Kolkata',
    profile: {
      status: 'complete',
      assessment: {},
      baseline: { requiresProfessionalReview: false },
    },
    plan: {
      status: 'active',
      content: {
        requiresProfessionalReview: false,
        workouts: [
          {
            day: 0,
            name: 'Chest & triceps',
            durationMinutes: 30,
            exercises: [
              { name: 'Push-up', sets: 3, reps: 12 },
              { name: 'Chest stretch', sets: 2, durationSeconds: 30 },
              { name: 'Third prescribed exercise', sets: 4, reps: 8 },
            ],
          },
        ],
      },
    },
    today: {
      date,
      recordedKinds: ['workout', 'sleep'],
      workouts: 1,
      workoutMinutes: 25,
      nutrients: {
        calories: 2100,
        proteinG: 100,
        carbsG: 250,
        fatG: 65,
        fibreG: 25,
      },
      waterMl: 0,
      steps: 0,
      sleepMinutes: 450,
      habitsCompleted: 0,
      weightKg: null,
      active: true,
    },
    weekly: {
      plannedDays: 3,
      completedPlannedDays: 1,
      plannedWorkouts: 3,
      completedPlannedWorkouts: 1,
      activeDays: 2,
      workouts: 4,
      workoutMinutes: 80,
      streak: 2,
      days: [],
    },
    logs: [],
  } as unknown as FitnessSummary;
}
function values(summary: FitnessSummary | undefined) {
  return Object.fromEntries(
    buildFitnessSettingsModel(summary, date).stats.map(stat => [
      stat.label,
      stat.value,
    ]),
  );
}
test('uses the saved workout and first two prescriptions, without invented load or food calories as movement', () => {
  const summary = fixture(),
    model = buildFitnessSettingsModel(summary, date);
  expect(model.focus).toBe('Chest & triceps');
  expect(model.focusNote).toBe('30 min · Saved workout');
  expect(model.exercises).toEqual([
    { name: 'Push-up', detail: '3 sets × 12 reps' },
    { name: 'Chest stretch', detail: '2 sets · 30 sec' },
  ]);
  expect(model.chestFocus).toBe(true);
  expect(values(summary)).toEqual({
    Movement: '25 min',
    'Due workouts · week': '1/3',
    'Current streak': '2 days',
    Sleep: '7h 30m',
  });
  expect(JSON.stringify(model)).not.toMatch(/65\s?kg|2100|Third prescribed/);
});
test.each(['baseline', 'plan', 'status', 'target'] as const)(
  'withholds all prescriptions for the %s professional-review signal',
  signal => {
    const summary = fixture();
    if (signal === 'baseline')
      summary.profile!.baseline!.requiresProfessionalReview = true;
    if (signal === 'plan')
      summary.plan!.content.requiresProfessionalReview = true;
    if (signal === 'status') summary.plan!.status = 'needs_review';
    if (signal === 'target') summary.targetStatus = 'needs_review';
    const model = buildFitnessSettingsModel(summary, date);
    expect(model.focus).toBe('Review your plan');
    expect(model.exercises).toEqual([]);
    expect(model.chestFocus).toBe(false);
    expect(values(summary).Movement).toBe('25 min');
  },
);
test.each(['missing profile', 'draft profile', 'pending plan'] as const)(
  'hides exercise guidance for %s while retaining recorded metrics',
  state => {
    const summary = fixture();
    if (state === 'missing profile') summary.profile = null;
    if (state === 'draft profile') summary.profile!.status = 'draft';
    if (state === 'pending plan') summary.plan!.status = 'pending';
    const model = buildFitnessSettingsModel(summary, date);
    expect(model.exercises).toEqual([]);
    expect(model.chestFocus).toBe(false);
    expect(values(summary).Sleep).toBe('7h 30m');
  },
);
test('distinguishes setup, no plan, and an explicit rest day', () => {
  expect(buildFitnessSettingsModel(undefined, date).focus).toBe(
    'Set up private Fitness',
  );
  expect(
    buildFitnessSettingsModel(undefined, date).stats.every(
      stat => stat.value === '—',
    ),
  ).toBe(true);
  const summary = fixture();
  summary.plan = null;
  expect(buildFitnessSettingsModel(summary, date).focus).toBe(
    'Create your plan',
  );
  summary.plan = fixture().plan;
  summary.plan!.content.workouts[0].day = 1;
  const rest = buildFitnessSettingsModel(summary, date);
  expect(rest.focus).toBe('Rest day');
  expect(rest.exercises).toEqual([]);
  expect(rest.chestFocus).toBe(false);
});
test.each(['summary', 'day', 'invalid expected date'] as const)(
  'rejects stale %s data for every today field and stat',
  part => {
    const summary = fixture();
    if (part === 'summary') summary.date = '2026-11-14';
    if (part === 'day') summary.today.date = '2026-11-14';
    const model = buildFitnessSettingsModel(
      summary,
      part === 'invalid expected date' ? '2026-02-30' : date,
    );
    expect(model.focus).toBe('Open today’s Fitness');
    expect(model.exercises).toEqual([]);
    expect(model.chestFocus).toBe(false);
    expect(model.stats.every(stat => stat.value === '—')).toBe(true);
  },
);
test('distinguishes an absent recorded metric from an explicitly recorded zero', () => {
  const summary = fixture();
  summary.today.workoutMinutes = 0;
  summary.today.sleepMinutes = 0;
  summary.today.recordedKinds = [];
  expect(values(summary).Movement).toBe('—');
  expect(values(summary).Sleep).toBe('—');
  summary.today.recordedKinds = ['workout', 'sleep'];
  expect(values(summary).Movement).toBe('0 min');
  expect(values(summary).Sleep).toBe('0h 0m');
});
test('legacy absent recordedKinds uses only same-date actual log evidence, not aggregate default zeros', () => {
  const summary = fixture();
  delete summary.today.recordedKinds;
  summary.today.workoutMinutes = 0;
  summary.today.sleepMinutes = 0;
  expect(values(summary).Movement).toBe('—');
  expect(values(summary).Sleep).toBe('—');
  summary.logs = [
    { kind: 'sleep', date: '2026-11-14', data: { durationMinutes: 0 } },
  ] as FitnessSummary['logs'];
  expect(values(summary).Sleep).toBe('—');
  summary.logs = [
    {
      kind: 'workout',
      date,
      data: {
        status: 'completed',
        name: 'Walk',
        exercises: [],
        durationMinutes: 0,
      },
    },
    { kind: 'sleep', date, data: { durationMinutes: 0 } },
  ] as FitnessSummary['logs'];
  expect(values(summary).Movement).toBe('0 min');
  expect(values(summary).Sleep).toBe('0h 0m');
});
test('scheduled completion never mixes manual workout totals or invents a missing denominator', () => {
  const summary = fixture();
  summary.weekly.workouts = 9;
  summary.weekly.completedPlannedWorkouts = 0;
  expect(values(summary)['Due workouts · week']).toBe('0/3');
  delete summary.weekly.plannedWorkouts;
  expect(values(summary)['Workouts · week']).toBe('9');
  expect(values(summary)['Due workouts · week']).toBeUndefined();
  summary.weekly.plannedWorkouts = 3;
  delete summary.weekly.completedPlannedWorkouts;
  expect(values(summary)['Workouts · week']).toBe('9');
});
test('chest emphasis requires an explicit current workout name, not its exercises or an unrelated day', () => {
  const summary = fixture();
  summary.plan!.content.workouts[0].name = 'Upper body';
  expect(buildFitnessSettingsModel(summary, date).chestFocus).toBe(false);
  summary.plan!.content.workouts.push({
    ...summary.plan!.content.workouts[0],
    day: 1,
    name: 'Chest day',
  });
  expect(buildFitnessSettingsModel(summary, date).chestFocus).toBe(false);
  summary.plan!.content.workouts[0].name = 'Pectoral strength';
  expect(buildFitnessSettingsModel(summary, date).chestFocus).toBe(true);
  summary.plan!.content.workouts[0].name = 'Pectorals';
  expect(buildFitnessSettingsModel(summary, date).chestFocus).toBe(true);
});

test.each([
  'baseline review',
  'plan review',
  'target review',
  'plan needs_review',
  'pending plan',
  'archived plan',
  'missing plan',
  'missing profile',
  'draft profile',
  'no_plan target',
] as const)(
  '%s displays actual logged workouts without a stale clinical denominator',
  state => {
    const summary = fixture();
    summary.weekly.plannedWorkouts = 999;
    summary.weekly.completedPlannedWorkouts = 1;
    if (state === 'baseline review')
      summary.profile!.baseline!.requiresProfessionalReview = true;
    if (state === 'plan review')
      summary.plan!.content.requiresProfessionalReview = true;
    if (state === 'target review') summary.targetStatus = 'needs_review';
    if (state === 'plan needs_review') summary.plan!.status = 'needs_review';
    if (state === 'pending plan') summary.plan!.status = 'pending';
    if (state === 'archived plan') summary.plan!.status = 'archived';
    if (state === 'missing plan') summary.plan = null;
    if (state === 'missing profile') summary.profile = null;
    if (state === 'draft profile') summary.profile!.status = 'draft';
    if (state === 'no_plan target') summary.targetStatus = 'no_plan';
    const model = buildFitnessSettingsModel(summary, date);
    expect(model.stats).toEqual([
      { label: 'Movement', value: '25 min' },
      { label: 'Workouts · week', value: '4' },
      { label: 'Current streak', value: '2 days' },
      { label: 'Sleep', value: '7h 30m' },
    ]);
    expect(JSON.stringify(model)).not.toContain('999');
    expect(model.exercises).toEqual([]);
  },
);

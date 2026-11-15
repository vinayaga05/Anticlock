import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FitnessHomeScreen, TodayNutrition } from './FitnessHomeScreen';
import { FitnessProgressScreen } from './FitnessProgressScreen';
import { FitnessAction } from '../components/FitnessUI';
import { FitnessChart } from '../components/FitnessChart';
import { FitnessDailyNutrition } from '../components/FitnessTargetCards';
import { FitnessDatePicker } from '../components/FitnessControls';

const mockWaterMutation = jest.fn();
const mockNavigate = jest.fn();
let mockId = 0;
let mockSummary: any;
let mockProgress: any;
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    canGoBack: () => true,
  }),
  useRoute: () => ({ params: { from: '2026-11-01', to: '2026-11-14' } }),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'customer-a' } }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../experts/components/FitnessExpertHome', () => ({
  FitnessExpertHome: () => null,
}));
jest.mock('../components/FitnessPrivateMedia', () => ({
  FitnessPrivateMedia: () => null,
}));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const node =
    (tag: string) =>
    ({ children, ...props }: any) =>
      React.createElement(tag, props, children);
  return {
    __esModule: true,
    default: node('svg'),
    Defs: node('defs'),
    Path: node('path'),
    Ellipse: node('ellipse'),
    G: node('g'),
    LinearGradient: node('linearGradient'),
    Stop: node('stop'),
    Circle: node('circle'),
    Line: node('line'),
    Polyline: node('polyline'),
    Rect: node('rect'),
  };
});
jest.mock('../api/fitnessApi', () => ({
  useFitnessMutation: () => ({
    mutateAsync: mockWaterMutation,
    isPending: false,
  }),
  newFitnessRequestId: () => `request-${++mockId}`,
  useFitnessQuery: (path: string) => ({
    data: path.startsWith('/summary?')
      ? mockSummary
      : path.startsWith('/progress?')
      ? mockProgress
      : path === '/plans'
      ? { plans: [] }
      : { media: [] },
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: jest.fn(),
  }),
}));

function fixtures() {
  const targets = {
    calories: { min: 1800, max: 2200 },
    proteinG: { min: 80, max: 100 },
    carbsG: { min: 200, max: 240 },
    fatG: { min: 50, max: 70 },
    fibreG: { min: 25, max: 30 },
    waterMl: { min: 2000, max: 2400 },
    steps: { min: 6000, max: 8000 },
    sleepMinutes: { min: 420, max: 540 },
    habits: [],
  };
  const day = {
    date: '2026-11-14',
    recordedKinds: ['workout', 'meal', 'water', 'steps', 'sleep', 'habit'],
    workouts: 2,
    workoutMinutes: 30,
    nutrients: {
      calories: 1400,
      proteinG: 76,
      carbsG: 150,
      fatG: 48,
      fibreG: 21,
    },
    waterMl: 1500,
    steps: 6800,
    sleepMinutes: 455,
    habitsCompleted: 1,
    weightKg: null,
    active: true,
  };
  const weight = {
    startWeightKg: 75,
    currentWeightKg: 72,
    targetWeightKg: 70,
    changeKg: -3,
    remainingKg: 2,
    progressPercent: 60,
    source: 'measurement',
    date: '2026-11-12',
    startDate: '2026-11-01',
    startSource: 'initial_assessment',
  };
  const snapshot = { weightKg: 72, date: '2026-11-12', source: 'measurement' };
  const plan = {
    id: 'plan-a',
    title: 'Saved plan',
    currentVersion: 2,
    status: 'active',
    content: {
      description: 'Saved description',
      requiresProfessionalReview: false,
      workouts: [],
    },
  };
  return {
    summary: {
      date: '2026-11-14',
      profile: {
        status: 'complete',
        assessment: { weightKg: 75, targetWeightKg: 999 },
        baseline: { requiresProfessionalReview: false },
      },
      plan,
      today: day,
      latestWeight: snapshot,
      weightProgress: weight,
      targetStatus: 'available',
      targets,
      todayWorkout: { planned: 1, completed: 0, completionPercent: 0 },
      weekly: {
        activeDays: 3,
        workouts: 4,
        workoutMinutes: 90,
        streak: 2,
        days: [day],
        plannedDays: 3,
        completedPlannedDays: 2,
        plannedWorkouts: 3,
        completedPlannedWorkouts: 2,
        completionPercent: 66.7,
        consistencyPercent: 66.7,
      },
      logs: [],
    },
    progress: {
      from: '2026-11-01',
      to: '2026-11-14',
      days: [day],
      totals: {
        activeDays: 3,
        workouts: 4,
        workoutMinutes: 90,
        nutrients: day.nutrients,
        waterMl: 1500,
        steps: 6800,
        sleepMinutes: 455,
        habitsCompleted: 1,
      },
      streak: 2,
      weightChangeKg: -3,
      strength: [],
      insights: [],
      latestWeight: snapshot,
      currentWeightProgress: weight,
      currentTargets: targets,
      targetStatus: 'available',
      targetBasisNotice:
        'Historical target versions are unavailable on some dates; current targets are comparisons, not historical recommendations.',
      adherence: {
        recordedDays: 3,
        nutritionRecordedDays: 2,
        nutritionInRangeDays: 1,
        nutritionInRangePercent: 50,
        plannedWorkouts: 3,
        completedPlannedWorkouts: 2,
        completionPercent: 66.7,
      },
      comparisons: [
        {
          date: '2026-11-10',
          planId: 'plan-a',
          version: null,
          basis: 'current_targets',
          targets,
          nutrition: {
            calories: {
              actual: 1400,
              targetMin: 1800,
              targetMax: 2200,
              percent: 70,
              inRange: false,
              relation: 'below',
            },
            proteinG: null,
            carbsG: null,
            fatG: null,
            fibreG: null,
          },
          water: null,
          steps: null,
          sleep: null,
          workout: { planned: 1, completed: 1, completionPercent: 100 },
        },
      ],
    },
  };
}
function text(node: any): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return (node?.children ?? [])
    .map(text)
    .join(node?.type === 'Text' ? '' : '\n');
}
const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
async function render(Component: React.ComponentType) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Component />);
  });
  renderers.push(renderer);
  return renderer;
}
beforeEach(() => {
  mockWaterMutation.mockReset().mockResolvedValue({});
  mockNavigate.mockClear();
  mockId = 0;
  const f = fixtures();
  mockSummary = f.summary;
  mockProgress = f.progress;
});
afterEach(() =>
  ReactTestRenderer.act(() => renderers.splice(0).forEach(r => r.unmount())),
);
test('home shows today targets and strict scheduled completion; detail statistics stay in Progress', async () => {
  const r = await render(FitnessHomeScreen);
  const output = text(r.toJSON());
  expect(r.root.findByType(TodayNutrition).props.targets).toBe(
    mockSummary.targets,
  );
  expect(output).toContain('Daily reference · 1800–2200 kcal');
  expect(output).toContain('0 of 1 scheduled workouts complete');
  expect(output).not.toContain('66.7%');
  expect(output).not.toContain('999 kg');
  expect(output).not.toContain('Weight record');
  expect(output).toContain('Progress');
  expect(output).toContain('Browse experts');
});
test('no-plan and missing entries never become zero logs or invented completion percentages', async () => {
  mockSummary = {
    ...mockSummary,
    plan: null,
    targetStatus: 'no_plan',
    targets: null,
    latestWeight: null,
    weightProgress: null,
    today: { ...mockSummary.today, recordedKinds: [] },
    weekly: { ...mockSummary.weekly, consistencyPercent: null },
  };
  const r = await render(FitnessHomeScreen);
  const output = text(r.toJSON());
  expect(output).toContain('No meals yet');
  expect(output).toContain('No water entry yet');
  expect(output).toContain('Create my plan');
  expect(output).not.toContain('100%');
  expect(output).not.toContain('0 kcal logged');
});
test('professional review withholds numeric targets even if an old response contains them', async () => {
  mockSummary.targetStatus = 'needs_review';
  mockSummary.targets.calories = { min: 9999, max: 9999 };
  const r = await render(FitnessHomeScreen);
  const output = text(r.toJSON());
  expect(output).toContain('Targets withheld for professional review');
  expect(output).not.toContain('9999');
  expect(output).not.toContain('Chosen target · 70');
  expect(output).not.toContain('66.7%');
});
test('quick glass retries the same request after a lost acknowledgement and creates a new ID only after success', async () => {
  mockWaterMutation.mockRejectedValueOnce(new Error('Network interrupted'));
  const r = await render(FitnessHomeScreen);
  const click = async (label: string) =>
    ReactTestRenderer.act(async () =>
      r.root
        .findAllByType(FitnessAction)
        .find(a => a.props.label === label)!
        .props.onPress(),
    );
  await click('Add glass · 250 ml');
  expect(text(r.toJSON())).toContain('Network interrupted');
  const first = mockWaterMutation.mock.calls[0][0];
  await click('Retry glass');
  expect(mockWaterMutation.mock.calls[1][0]).toEqual(first);
  expect(first.body.data).toEqual({ amountMl: 250 });
  expect(first.path).toBe('/logs/water');
  await click('Add glass · 250 ml');
  expect(mockWaterMutation.mock.calls[2][0].body.clientRequestId).not.toBe(
    first.body.clientRequestId,
  );
});
test('planned workout carries provider plan context and unscheduled activity stays manual', async () => {
  mockSummary.plan.content.workouts = [
    {
      day: new Date(`${mockSummary.date}T12:00:00`).getDay(),
      name: 'Saved strength session',
      durationMinutes: 25,
    },
  ];
  const r = await render(FitnessHomeScreen);
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessAction)
      .find(a => a.props.label === 'Start workout')!
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenLastCalledWith('FitnessWorkout', {
    planId: 'plan-a',
    day: 6,
    date: '2026-11-14',
  });
  mockSummary.plan.content.workouts = [];
  await ReactTestRenderer.act(async () => r.update(<FitnessHomeScreen />));
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessAction)
      .find(a => a.props.label === 'Log my own activity')!
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenLastCalledWith('FitnessWorkout', {
    date: '2026-11-14',
  });
});
test('progress labels current targets as comparisons and counts calorie-range matches rather than nutrition quality', async () => {
  const r = await render(FitnessProgressScreen);
  let output = text(r.toJSON());
  expect(output).not.toContain('Current daily reference ranges');
  await ReactTestRenderer.act(async () =>
    r.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Explore the details' &&
          n.props.accessibilityRole === 'button',
      )[0]
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () =>
    r.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'About these comparisons' &&
          n.props.accessibilityRole === 'button',
      )[0]
      .props.onPress(),
  );
  output = text(r.toJSON());
  expect(output).toContain(
    '1 of 2 recorded meal days within the compared calorie range · 50%',
  );
  expect(output).toContain('not a nutrition quality score');
  expect(output).toContain('Current daily reference ranges');
  expect(output).toContain(
    'Current saved snapshot, separate from the selected history period.',
  );
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessAction)
      .find(action => action.props.label === 'Review daily target comparisons')!
      .props.onPress(),
  );
  output = text(r.toJSON());
  expect(output).toContain(
    'These are current saved targets, not recommendations that applied on this date.',
  );
  expect(output).toContain('Daily reference · 1800–2200 kcal');
});
test('strength time comparison uses explicit dated loads and never plots bodyweight as zero kilograms', async () => {
  mockProgress.strength = [
    {
      exercise: 'Dumbbell row',
      maxWeightKg: 10,
      totalReps: 36,
      hasRecordedLoad: true,
      weightChangeKg: 2,
      series: [
        { date: '2026-11-01', maxWeightKg: 8, totalReps: 16 },
        { date: '2026-11-12', maxWeightKg: 10, totalReps: 20 },
      ],
    },
    {
      exercise: 'Chair squat',
      maxWeightKg: 0,
      totalReps: 40,
      hasRecordedLoad: false,
      weightChangeKg: null,
      series: [],
    },
  ];
  const r = await render(FitnessProgressScreen);
  expect(text(r.toJSON())).not.toContain('First recorded');
  await ReactTestRenderer.act(async () =>
    r.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Explore the details' &&
          n.props.accessibilityRole === 'button',
      )[0]
      .props.onPress(),
  );
  const output = text(r.toJSON());
  expect(output).toContain('First recorded · 2026-11-01 · 8 kg');
  expect(output).toContain('Latest recorded · 2026-11-12 · 10 kg');
  expect(output).toContain('No external load recorded');
  expect(output).not.toContain('Highest recorded external load 0');
  expect(
    r.root
      .findAllByType(FitnessChart)
      .find(
        chart => chart.props.title === 'Dumbbell row recorded external load',
      )!.props.values,
  ).toEqual([8, 10]);
});
test('progress suppresses numeric comparisons when current professional review is required', async () => {
  mockProgress.targetStatus = 'needs_review';
  mockProgress.currentTargets.calories = { min: 9999, max: 9999 };
  const r = await render(FitnessProgressScreen);
  await ReactTestRenderer.act(async () =>
    r.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Explore the details' &&
          n.props.accessibilityRole === 'button',
      )[0]
      .props.onPress(),
  );
  const output = text(r.toJSON());
  expect(output).toContain('Numeric reference ranges are withheld');
  expect(output).not.toContain('9999');
  expect(output).not.toContain('Chosen target · 70');
  expect(
    r.root
      .findAllByType(FitnessAction)
      .some(action => action.props.label === 'Review daily target comparisons'),
  ).toBe(false);
});

test('progress uses saved scheduled completion and keeps missing measurements distinct from an explicit zero', async () => {
  const day = mockProgress.days[0];
  mockProgress.totals.workouts = 14;
  mockProgress.adherence = {
    ...mockProgress.adherence,
    plannedWorkouts: 4,
    completedPlannedWorkouts: 1,
    completionPercent: 25,
  };
  mockProgress.days = [
    { ...day, date: '2026-11-01', recordedKinds: [], weightKg: null },
    { ...day, date: '2026-11-02', recordedKinds: ['weight'], weightKg: 0 },
    { ...day, date: '2026-11-03', recordedKinds: ['weight'], weightKg: 72 },
  ];
  const r = await render(FitnessProgressScreen);
  const output = text(r.toJSON());
  expect(output).toContain('25%');
  expect(output).toContain('1 of 4 due scheduled workouts complete');
  expect(output).not.toContain('14 of 4');
  expect(
    r.root
      .findAllByType(FitnessChart)
      .find(chart => chart.props.title === 'Weight (kg)')!.props.values,
  ).toEqual([null, 0, 72]);
  expect(output).not.toContain('Current daily reference ranges');
});

test('progress custom dates use bounded pickers and keep advanced comparisons collapsed', async () => {
  const r = await render(FitnessProgressScreen);
  let pickers = r.root.findAllByType(FitnessDatePicker);
  expect(pickers.map(picker => picker.props.label)).toEqual([
    'From date',
    'To date',
  ]);
  expect(pickers[0].props.maximumDate).toBe('2026-11-14');
  expect(pickers[1].props.minimumDate).toBe('2026-11-01');
  await ReactTestRenderer.act(async () =>
    pickers[0].props.onChange('2026-11-05'),
  );
  pickers = r.root.findAllByType(FitnessDatePicker);
  expect(pickers[0].props.value).toBe('2026-11-05');
  expect(pickers[1].props.minimumDate).toBe('2026-11-05');
  expect(text(r.toJSON())).not.toContain('Current daily reference ranges');
});

test('nutrition cards preserve explicit zero and withhold stale clinical targets', async () => {
  const day = {
    ...mockSummary.today,
    nutrients: { ...mockSummary.today.nutrients, calories: 0 },
  };
  const r = await render(() => (
    <FitnessDailyNutrition
      day={day}
      targets={{ ...mockSummary.targets, calories: { min: 9999, max: 9999 } }}
      status="needs_review"
    />
  ));
  expect(text(r.toJSON())).toContain('0 kcal logged');
  expect(text(r.toJSON())).not.toContain('9999');
  await ReactTestRenderer.act(async () =>
    r.update(
      <FitnessDailyNutrition
        day={{ ...day, recordedKinds: [] }}
        targets={null}
        status="no_plan"
      />,
    ),
  );
  expect(text(r.toJSON())).toContain('No entry');
  expect(text(r.toJSON())).not.toContain('0 kcal logged');
});

test('zero-valued saved reference ranges never produce invalid visual dimensions', async () => {
  mockSummary.targets.proteinG = { min: 0, max: 50 };
  mockSummary.targets.calories = { min: 0, max: 0 };
  mockSummary.targets.waterMl = { min: 0, max: 0 };
  mockSummary.today.nutrients.proteinG = 0;
  mockSummary.today.nutrients.calories = 0;
  mockSummary.today.waterMl = 0;
  const r = await render(FitnessHomeScreen);
  expect(JSON.stringify(r.toJSON())).not.toMatch(/NaN|Infinity/);
  expect(text(r.toJSON())).toContain('kcal logged');
});

import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import type { FitnessSummary } from '@anticlock/contracts';
import { FitnessSettingsCard } from './FitnessSettingsCard';

const DATE = '2026-11-15'; // Sunday, independent of the machine timezone.
let mockUser: { id: string; displayName: string } | null;
let mockAuthLoading = false;
let mockFocused = true;
let mockEpoch = 0;
let mockCurrentEpoch = 0;
let mockDate = DATE;
let mockTimezone = 'Asia/Kolkata';
let mockPublishingType = 'personal';
const mockRefetch = jest.fn();
const mockOnPress = jest.fn();
const mockPublishingRead = jest.fn();
const mockAppStateListeners = new Set<(state: string) => void>();
const mockQueryResult: {
  data: FitnessSummary | undefined;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: typeof mockRefetch;
} = {
  data: undefined,
  isPending: false,
  isLoading: false,
  isError: false,
  error: null,
  refetch: mockRefetch,
};
const mockUseFitnessQuery = jest.fn(
  (_path: string, _enabled?: boolean, _scope?: number) => mockQueryResult,
);

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.create(actual, {
    useWindowDimensions: {
      value: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    },
    AppState: {
      value: {
        currentState: 'active',
        addEventListener: (
          _event: string,
          listener: (state: string) => void,
        ) => {
          mockAppStateListeners.add(listener);
          return { remove: () => mockAppStateListeners.delete(listener) };
        },
      },
    },
  });
});
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const R = require('react');
    R.useEffect(
      () => (mockFocused ? effect() : undefined),
      [effect, mockFocused],
    );
  },
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, loading: mockAuthLoading }),
}));
jest.mock('@/features/fitness/api/fitnessApi', () => ({
  useFitnessQuery: (path: string, enabled?: boolean, scope?: number) =>
    mockUseFitnessQuery(path, enabled, scope),
}));
jest.mock('@/features/fitness/fitnessSession', () => ({
  useFitnessDataEpoch: () => mockEpoch,
  getFitnessDataEpoch: () => mockCurrentEpoch,
}));
jest.mock('@/features/fitness/fitnessModel', () => ({
  ...jest.requireActual('@/features/fitness/fitnessModel'),
  localFitnessDate: () => mockDate,
  fitnessTimezone: () => mockTimezone,
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => {
    mockPublishingRead();
    return { active: { id: 'unrelated-business', type: mockPublishingType } };
  },
}));
jest.mock('@/shared/components/AppIcon', () => ({
  AppIcon: (props: { name: string; size?: number }) =>
    require('react').createElement('test-icon', {
      ...props,
      testID: `icon-${props.name}`,
    }),
}));
jest.mock('react-native-svg', () => {
  const R = require('react');
  const host =
    (name: string) =>
    ({ children, ...props }: any) =>
      R.createElement(name, props, children);
  return {
    __esModule: true,
    default: host('svg'),
    Circle: host('circle'),
    Defs: host('defs'),
    Ellipse: host('ellipse'),
    G: host('g'),
    Line: host('line'),
    LinearGradient: host('linearGradient'),
    Path: host('path'),
    Polygon: host('polygon'),
    Polyline: host('polyline'),
    RadialGradient: host('radialGradient'),
    Rect: host('rect'),
    Stop: host('stop'),
    Text: host('svgText'),
    TSpan: host('tspan'),
    Use: host('use'),
    ClipPath: host('clipPath'),
    Mask: host('mask'),
  };
});

function savedSummary(): FitnessSummary {
  return {
    date: DATE,
    timezone: 'Asia/Kolkata',
    targetStatus: 'available',
    profile: {
      userId: 'owner-a',
      status: 'complete',
      assessment: {},
      baseline: { requiresProfessionalReview: false },
    },
    plan: {
      id: 'actual-plan',
      status: 'active',
      currentVersion: 2,
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
              { name: 'Third saved exercise', sets: 4, reps: 8 },
            ],
          },
        ],
      },
    },
    today: {
      date: DATE,
      recordedKinds: ['workout', 'sleep'],
      workouts: 1,
      workoutMinutes: 25,
      nutrients: {
        calories: 650,
        proteinG: 100,
        carbsG: 250,
        fatG: 65,
        fibreG: 25,
      },
      waterMl: 0,
      steps: 0,
      sleepMinutes: 450,
      habitsCompleted: 0,
      weightKg: 65,
      active: true,
    },
    weekly: {
      plannedWorkouts: 3,
      completedPlannedWorkouts: 1,
      plannedDays: 3,
      completedPlannedDays: 1,
      activeDays: 2,
      workouts: 4,
      workoutMinutes: 80,
      streak: 2,
      days: [],
    },
    logs: [],
  } as unknown as FitnessSummary;
}
let tree: Renderer.ReactTestRenderer | undefined;
async function render() {
  await act(async () => {
    tree = Renderer.create(<FitnessSettingsCard onPress={mockOnPress} />);
  });
  return tree!;
}
async function update() {
  await act(async () => {
    tree!.update(<FitnessSettingsCard onPress={mockOnPress} />);
  });
}
function text(node: any = tree!.toJSON()): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(value => text(value)).join(' ');
  return (node?.children ?? []).map((value: any) => text(value)).join(' ');
}
function cardActions() {
  return tree!.root.findAll(node => {
    if (
      node.props.testID !== 'settings-open-fitness' ||
      typeof node.props.onPress !== 'function'
    )
      return false;
    let parent = node.parent;
    while (parent) {
      if (
        parent.props.testID === 'settings-open-fitness' &&
        typeof parent.props.onPress === 'function'
      )
        return false;
      parent = parent.parent;
    }
    return true;
  });
}
function stat(label: string) {
  return tree!.root
    .findAllByType(Text)
    .find(node => node.props.testID === `fitness-stat-${label}`)?.props
    .children;
}
function expectPrivateDetailsHidden() {
  expect(text()).not.toContain('Chest & triceps');
  expect(text()).not.toContain('Push-up');
  expect(text()).not.toContain('25 min');
  expect(stat('Movement')).toBe('—');
  expect(stat('Sleep')).toBe('—');
}
beforeEach(() => {
  mockUser = { id: 'owner-a', displayName: 'Actual owner' };
  mockAuthLoading = false;
  mockFocused = true;
  mockEpoch = mockCurrentEpoch = 0;
  mockDate = DATE;
  mockTimezone = 'Asia/Kolkata';
  mockPublishingType = 'personal';
  mockPublishingRead.mockClear();
  mockOnPress.mockClear();
  mockRefetch.mockReset().mockResolvedValue(undefined);
  mockUseFitnessQuery.mockClear();
  Object.assign(mockQueryResult, {
    data: savedSummary(),
    isPending: false,
    isLoading: false,
    isError: false,
    error: null,
  });
});
afterEach(async () => {
  const mounted = tree;
  tree = undefined;
  try {
    await act(async () => mounted?.unmount());
    expect(mockAppStateListeners.size).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('shows the actual saved focus, first two exercise prescriptions and recorded stats', async () => {
  await render();
  expect(text()).toContain('Chest & triceps');
  expect(text()).toContain('Push-up');
  expect(text()).toContain('3 sets × 12 reps');
  expect(text()).toContain('Chest stretch');
  expect(text()).toContain('2 sets · 30 sec');
  expect(text()).not.toContain('Third saved exercise');
  expect(stat('Movement')).toBe('25 min');
  expect(stat('Due workouts · week')).toBe('1/3');
  expect(stat('Current streak')).toBe('2 days');
  expect(stat('Sleep')).toBe('7h 30m');
  expect(text()).not.toMatch(/650|65\s?kg|Active Cal/);
  expect(mockUseFitnessQuery).toHaveBeenLastCalledWith(
    '/summary?date=2026-11-15&timezone=Asia%2FKolkata',
    true,
    0,
  );
});

test.each(['baseline', 'plan', 'status', 'target'] as const)(
  'withholds prescriptions for a %s review signal while retaining actual logs',
  async signal => {
    const summary = savedSummary();
    if (signal === 'baseline')
      summary.profile!.baseline!.requiresProfessionalReview = true;
    if (signal === 'plan')
      summary.plan!.content.requiresProfessionalReview = true;
    if (signal === 'status') summary.plan!.status = 'needs_review';
    if (signal === 'target') summary.targetStatus = 'needs_review';
    mockQueryResult.data = summary;
    await render();
    expect(text()).toContain('Review your plan');
    expect(text()).not.toContain('Chest & triceps');
    expect(text()).not.toContain('Push-up');
    expect(stat('Movement')).toBe('25 min');
    expect(tree!.root.findAll(node => node.type === 'ellipse')).toHaveLength(0);
  },
);

test('a pending plan supplies no automatic exercise prescription', async () => {
  mockQueryResult.data!.plan!.status = 'pending';
  await render();
  expect(text()).toContain('Your plan is not ready');
  expect(text()).not.toContain('Push-up');
  expect(stat('Movement')).toBe('25 min');
});

test('unknown data contains no reference-demo workout, load or invented activity', async () => {
  mockQueryResult.data = undefined;
  await render();
  expectPrivateDetailsHidden();
  expect(text()).toContain('Set up private Fitness');
  expect(text()).not.toMatch(/650|65\s?kg|Chest|Bench Press/);
});

test('missing recorded entries stay unknown while explicit recorded zeros remain zeros', async () => {
  mockQueryResult.data!.today.recordedKinds = [];
  mockQueryResult.data!.today.workoutMinutes = 0;
  mockQueryResult.data!.today.sleepMinutes = 0;
  await render();
  expect(stat('Movement')).toBe('—');
  expect(stat('Sleep')).toBe('—');
  mockQueryResult.data!.today.recordedKinds = ['workout', 'sleep'];
  await update();
  expect(stat('Movement')).toBe('0 min');
  expect(stat('Sleep')).toBe('0h 0m');
});

test.each(['loading', 'error'] as const)(
  '%s state hides cached private values and keeps the card usable',
  async state => {
    if (state === 'loading') {
      mockQueryResult.data = undefined;
      mockQueryResult.isPending = mockQueryResult.isLoading = true;
    } else {
      mockQueryResult.isError = true;
      mockQueryResult.error = new Error('Unavailable');
    }
    await render();
    expectPrivateDetailsHidden();
    expect(text()).toContain(
      state === 'loading'
        ? 'Opening your saved fitness details'
        : 'Details unavailable',
    );
    expect(cardActions()).toHaveLength(1);
  },
);

test('the single whole-card action invokes the provided FitnessHome entry callback', async () => {
  await render();
  const actions = cardActions();
  expect(actions).toHaveLength(1);
  expect(actions[0].props.testID).toBe('settings-open-fitness');
  expect(actions[0].props.accessibilityRole).toBe('button');
  await act(async () => actions[0].props.onPress());
  expect(mockOnPress).toHaveBeenCalledTimes(1);
});

test('the whole-card accessible label includes the visible scheduled exercise instructions', async () => {
  await render();
  const label = cardActions()[0].props.accessibilityLabel;
  for (const visible of [
    'Chest & triceps',
    'Push-up',
    '3 sets × 12 reps',
    'Chest stretch',
    '2 sets · 30 sec',
  ])
    expect(label).toContain(visible);
  expect(label).not.toContain('Third saved exercise');
});

test('a failed decorative asset falls back to the icon without hiding saved content', async () => {
  await render();
  const image = tree!.root.findByType(Image);
  expect(typeof image.props.onLoad).toBe('function');
  await act(async () => image.props.onLoad());
  expect(tree!.root.findAll(node => node.type === 'ellipse')).toHaveLength(1);
  await act(async () => image.props.onError());
  expect(tree!.root.findAllByType(Image)).toHaveLength(0);
  expect(
    tree!.root.findAll(
      node => node.props.testID === 'icon-fitness' && node.props.size > 40,
    ).length,
  ).toBeGreaterThan(0);
  expect(tree!.root.findAll(node => node.type === 'ellipse')).toHaveLength(0);
  expect(text()).toContain('Push-up');
});

test.each(['signed out', 'guest', 'auth loading', 'unfocused'] as const)(
  '%s never reads or displays cached private details',
  async state => {
    await render();
    expect(text()).toContain('Chest & triceps');
    if (state === 'signed out') mockUser = null;
    if (state === 'guest')
      mockUser = { id: 'temporary-guest', displayName: 'Guest' };
    if (state === 'auth loading') mockAuthLoading = true;
    if (state === 'unfocused') mockFocused = false;
    await update();
    expectPrivateDetailsHidden();
    expect(mockUseFitnessQuery).toHaveBeenLastCalledWith(
      expect.any(String),
      false,
      0,
    );
  },
);

test('a deletion epoch invalidates cached details before the React epoch subscription rerenders', async () => {
  await render();
  mockCurrentEpoch = 1;
  await update();
  expectPrivateDetailsHidden();
  mockEpoch = 1;
  mockQueryResult.data = undefined; // The new epoch has a separate, empty query cache.
  await update();
  expectPrivateDetailsHidden();
  expect(mockUseFitnessQuery).toHaveBeenLastCalledWith(
    expect.any(String),
    true,
    1,
  );
});

test('switching publishing identity leaves the signed-in user as the health owner', async () => {
  await render();
  mockPublishingType = 'business';
  await update();
  expect(text()).toContain('Chest & triceps');
  expect(stat('Movement')).toBe('25 min');
  expect(mockPublishingRead).not.toHaveBeenCalled();
  expect(mockUseFitnessQuery).toHaveBeenLastCalledWith(
    '/summary?date=2026-11-15&timezone=Asia%2FKolkata',
    true,
    0,
  );
});

test('foreground date rollover replaces the request date and immediately hides yesterday’s cached values', async () => {
  await render();
  mockDate = '2026-11-16';
  await act(async () =>
    mockAppStateListeners.forEach(listener => listener('active')),
  );
  expectPrivateDetailsHidden();
  expect(mockUseFitnessQuery).toHaveBeenLastCalledWith(
    '/summary?date=2026-11-16&timezone=Asia%2FKolkata',
    true,
    0,
  );
});

test('an open card refreshes at local midnight without waiting for the thirty-second poll', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 15, 23, 59, 59, 900));
  await render();
  expect(text()).toContain('Chest & triceps');
  mockDate = '2026-11-16';
  await act(async () => jest.advanceTimersByTimeAsync(126));
  expectPrivateDetailsHidden();
  expect(mockUseFitnessQuery).toHaveBeenLastCalledWith(
    '/summary?date=2026-11-16&timezone=Asia%2FKolkata',
    true,
    0,
  );
});

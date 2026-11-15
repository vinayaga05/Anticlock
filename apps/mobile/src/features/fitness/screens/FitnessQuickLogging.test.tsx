import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { FitnessHistoryScreen } from './FitnessHistoryScreen';
import { fitnessRange } from '../fitnessModel';
import { bumpFitnessDataEpoch } from '../fitnessSession';
import { FitnessLogScreen } from './FitnessLogScreen';
import { FitnessMealsScreen } from './FitnessMealsScreen';
import { FitnessWorkoutScreen } from './FitnessWorkoutScreen';
import { FitnessMediaSourceSheet } from '../components/FitnessMediaSourceSheet';
import {
  FitnessAction,
  FitnessChoices,
  FitnessField,
} from '../components/FitnessUI';
import {
  FitnessDisclosure,
  FitnessStepper,
  FitnessDatePicker,
} from '../components/FitnessControls';
const mockMutation = jest.fn(),
  mockNavigate = jest.fn(),
  mockDispatch = jest.fn(),
  mockUpload = jest.fn();
let mockDraftGuard: { enabled: boolean; callback: (event: any) => void };
let mockParams: any = {},
  mockQueries: Record<string, any> = {},
  mockSequence = 0;
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (enabled: boolean, callback: (event: any) => void) => {
    mockDraftGuard = { enabled, callback };
  },
  useNavigation: () => ({
    navigate: mockNavigate,
    dispatch: mockDispatch,
    push: mockNavigate,
    canGoBack: () => true,
    goBack: jest.fn(),
  }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'owner' } }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('lucide-react-native', () => {
  const R = require('react');
  return new Proxy(
    {},
    {
      get: (_t, name) =>
        name === '__esModule'
          ? true
          : (props: any) => R.createElement('icon', props),
    },
  );
});
jest.mock('../components/FitnessVisuals', () => ({
  FitnessPhoto: ({ children }: any) => children,
  FitnessIllustration: () => null,
}));
jest.mock('../components/FitnessPrivateMedia', () => ({
  FitnessPrivateMedia: () => null,
}));
jest.mock('../components/FitnessMediaSourceSheet', () => ({
  FitnessMediaSourceSheet: () => null,
}));
jest.mock('../fitnessMedia', () => ({
  uploadFitnessMedia: (...args: any[]) => mockUpload(...args),
}));
jest.mock('../logging/fitnessLoggingPreferences', () => ({
  useFitnessLoggingPreferences: () => ({
    favouriteFoodIds: [],
    toggleFavourite: jest.fn(),
  }),
}));
jest.mock('../api/fitnessApi', () => ({
  newFitnessRequestId: () => `request-${++mockSequence}`,
  useFitnessMutation: () => ({ mutateAsync: mockMutation, isPending: false }),
  useFitnessQuery: (path: string, enabled = true) => ({
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...(mockQueries[path] ?? {
      data:
        path === '/profile'
          ? {
              profile: {
                status: 'complete',
                baseline: { requiresProfessionalReview: false },
              },
            }
          : path === '/plans'
          ? { plans: [] }
          : path.endsWith('/versions')
          ? { versions: [] }
          : path.startsWith('/logs/')
          ? { logs: [] }
          : path === '/recipes'
          ? { recipes: [] }
          : { foods: [] },
    }),
    ...(!enabled ? { data: undefined, isPending: true, isError: false } : {}),
  }),
}));
const renderers: Renderer.ReactTestRenderer[] = [];
async function render(Component: React.ComponentType) {
  let r!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => {
    r = Renderer.create(<Component />);
  });
  renderers.push(r);
  return r;
}
function byLabel(r: Renderer.ReactTestRenderer, Component: any, label: string) {
  const found = r.root
    .findAllByType(Component)
    .find(node => node.props.label === label);
  expect(found).toBeDefined();
  return found!;
}
async function press(r: Renderer.ReactTestRenderer, label: string) {
  await Renderer.act(async () => {
    await byLabel(r, FitnessAction, label).props.onPress();
  });
}
async function open(r: Renderer.ReactTestRenderer, title: string) {
  const disclosure = r.root
    .findAllByType(FitnessDisclosure)
    .find(node => node.props.title === title);
  expect(disclosure).toBeDefined();
  const button = disclosure!.findAll(
    node =>
      node.props.accessibilityLabel === title &&
      typeof node.props.onPress === 'function',
  )[0];
  await Renderer.act(async () => button.props.onPress());
}
async function choose(
  r: Renderer.ReactTestRenderer,
  label: string,
  value: string,
) {
  await Renderer.act(async () =>
    byLabel(r, FitnessChoices, label).props.onChange(value),
  );
}
beforeEach(() => {
  mockParams = {};
  mockQueries = {};
  mockSequence = 0;
  mockMutation.mockReset().mockResolvedValue({});
  mockNavigate.mockReset();
  mockDispatch.mockReset();
  mockUpload.mockReset();
});
afterEach(() =>
  Renderer.act(() => renderers.splice(0).forEach(r => r.unmount())),
);
test('one-tap water preserves the request after a lost acknowledgement and rotates only after success', async () => {
  const r = await render(FitnessLogScreen);
  expect(byLabel(r, FitnessStepper, 'Glass size').props.value).toBe(250);
  mockMutation.mockRejectedValueOnce(new Error('Offline'));
  await press(r, 'Add 250 ml');
  const original = mockMutation.mock.calls[0][0];
  expect(original).toMatchObject({
    path: '/logs/water',
    method: 'POST',
    body: {
      clientRequestId: expect.any(String),
      data: { amountMl: 250, notes: '' },
    },
  });
  await press(r, 'Add 250 ml');
  expect(mockMutation.mock.calls[1][0]).toEqual(original);
  await press(r, 'Add 250 ml');
  expect(mockMutation.mock.calls[2][0].body.clientRequestId).not.toBe(
    original.body.clientRequestId,
  );
});
test('weight starts unset without a real saved reading and cannot silently submit its editable initial value', async () => {
  mockParams = { kind: 'weight' };
  const r = await render(FitnessLogScreen);
  expect(byLabel(r, FitnessStepper, 'Weight').props.value).toBeUndefined();
  expect(byLabel(r, FitnessStepper, 'Weight').props.initialValue).toBe(70);
  await press(r, 'Save entry');
  expect(mockMutation).not.toHaveBeenCalled();
  await Renderer.act(async () =>
    byLabel(r, FitnessStepper, 'Weight').props.onChange(84.2),
  );
  await press(r, 'Save entry');
  expect(mockMutation).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.objectContaining({
        data: expect.objectContaining({ weightKg: 84.2 }),
      }),
    }),
  );
});
test('editing a saved metric preserves its recorded date and writes a PATCH', async () => {
  mockParams = { kind: 'sleep', logId: 'sleep-1', date: '2001-01-01' };
  mockQueries['/logs/sleep/sleep-1'] = {
    data: {
      log: {
        id: 'sleep-1',
        kind: 'sleep',
        date: '2026-01-02',
        data: { durationMinutes: 420, quality: 'fair', notes: 'my note' },
      },
    },
  };
  const r = await render(FitnessLogScreen);
  expect(byLabel(r, FitnessStepper, 'Sleep duration').props.value).toBe(420);
  await Renderer.act(async () =>
    byLabel(r, FitnessStepper, 'Sleep duration').props.onChange(435),
  );
  await press(r, 'Save changes');
  expect(mockMutation).toHaveBeenCalledWith({
    path: '/logs/sleep/sleep-1',
    method: 'PATCH',
    body: { data: { durationMinutes: 435, quality: 'fair', notes: 'my note' } },
  });
});
test('recent meals reuse only actual food values and editable portions, not private notes or attachments', async () => {
  const nutrients = {
    calories: 120,
    proteinG: 4,
    carbsG: 20,
    fatG: 2,
    fibreG: 0,
  };
  mockQueries['/logs/meal'] = {
    data: {
      logs: [
        {
          id: 'old-meal',
          kind: 'meal',
          date: '2026-01-01',
          data: {
            mealType: 'breakfast',
            foods: [
              { foodId: 'food-1', name: 'My oats', servings: 1, nutrients },
            ],
            notes: 'private old note',
            mediaIds: ['old-photo'],
            estimate: true,
          },
        },
      ],
    },
  };
  const r = await render(FitnessMealsScreen);
  await press(r, 'Use foods from breakfast');
  await choose(r, 'Servings for My oats', '1½');
  mockMutation.mockRejectedValueOnce(new Error('Lost acknowledgement'));
  await press(r, 'Save meal');
  const call = mockMutation.mock.calls[0][0];
  expect(call.body.data).toEqual({
    mealType: 'breakfast',
    foods: [{ foodId: 'food-1', name: 'My oats', servings: 1.5, nutrients }],
    notes: '',
    estimate: true,
  });
  await press(r, 'Save meal');
  expect(mockMutation.mock.calls[1][0]).toEqual(call);
  expect(mockQueries['/logs/meal'].data.logs[0].data.foods[0].servings).toBe(1);
});
test('custom food does not invent missing macros; explicit package zero values remain valid', async () => {
  const r = await render(FitnessMealsScreen);
  await open(r, 'Add custom food');
  await Renderer.act(async () => {
    byLabel(r, FitnessField, 'Food name').props.onChangeText('Package food');
    byLabel(r, FitnessStepper, 'Calories (kcal)').props.onChange(90);
  });
  await press(r, 'Add manual food to meal');
  expect(mockMutation).not.toHaveBeenCalled();
  expect(byLabel(r, FitnessStepper, 'Protein (g)').props.value).toBeUndefined();
  for (const label of ['Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fibre (g)'])
    await Renderer.act(async () =>
      byLabel(r, FitnessStepper, label).props.onChange(0),
    );
  await press(r, 'Add manual food to meal');
  await press(r, 'Save meal');
  expect(mockMutation.mock.calls[0][0].body.data.foods).toEqual([
    {
      name: 'Package food',
      servings: 1,
      nutrients: { calories: 90, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
    },
  ]);
});
test('planned workout start retries the original UUID and saved version before patching edited actual sets', async () => {
  const date = '2026-11-15',
    plan = {
      id: 'plan-1',
      currentVersion: 3,
      status: 'active',
      content: {
        requiresProfessionalReview: false,
        workouts: [
          {
            day: 0,
            name: 'Sunday strength',
            durationMinutes: 30,
            exercises: [
              {
                name: 'Squat',
                sets: 2,
                reps: 8,
                instructions: 'Steady movement',
              },
            ],
          },
        ],
      },
    };
  mockParams = { planId: 'plan-1', day: 0, date };
  mockQueries['/plans'] = { data: { plans: [plan] } };
  const r = await render(FitnessWorkoutScreen);
  mockMutation.mockRejectedValueOnce(new Error('Lost start acknowledgement'));
  await press(r, 'Start workout');
  const first = mockMutation.mock.calls[0][0];
  expect(first.body.data).toMatchObject({
    planId: 'plan-1',
    planDay: 0,
    planVersion: 3,
    exercises: [],
  });
  await press(r, 'Log Squat');
  expect(
    byLabel(r, FitnessStepper, 'Reps · set 1').props.value,
  ).toBeUndefined();
  await Renderer.act(async () =>
    byLabel(r, FitnessStepper, 'Reps · set 1').props.onChange(6),
  );
  await press(r, 'Add exercise to workout');
  mockMutation.mockImplementation(async (input: any) => ({
    log: { id: 'saved-workout', date, kind: 'workout', data: input.body.data },
  }));
  await press(r, 'Start workout');
  expect(mockMutation.mock.calls[1][0]).toEqual(first);
  expect(mockMutation.mock.calls[2][0]).toMatchObject({
    path: '/logs/workout/saved-workout',
    method: 'PATCH',
    body: {
      data: {
        planVersion: 3,
        exercises: [{ name: 'Squat', sets: [{ reps: 6 }] }],
      },
    },
  });
});
test('manual workout never receives saved plan completion metadata', async () => {
  mockParams = { date: '2026-11-15' };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'plan',
          currentVersion: 2,
          status: 'active',
          content: {
            requiresProfessionalReview: false,
            workouts: [
              { day: 0, name: 'Planned', durationMinutes: 30, exercises: [] },
            ],
          },
        },
      ],
    },
  };
  const r = await render(FitnessWorkoutScreen);
  await choose(r, 'Activity', 'Walk');
  mockMutation.mockImplementation(async (input: any) => ({
    log: {
      id: 'manual',
      date: input.body.date,
      kind: 'workout',
      data: input.body.data,
    },
  }));
  await press(r, 'Start workout');
  expect(mockMutation.mock.calls[0][0].body.data).toMatchObject({
    name: 'Walk',
    exercises: [],
  });
  expect(mockMutation.mock.calls[0][0].body.data.planId).toBeUndefined();
  expect(mockMutation.mock.calls[0][0].body.data.planVersion).toBeUndefined();
});

test('history opens the exact saved workout and requires confirmation before deleting a journal entry', async () => {
  const range = fitnessRange('month');
  mockQueries[`/logs/workout?from=${range.from}&to=${range.to}`] = {
    data: {
      logs: [
        {
          id: 'original-workout',
          kind: 'workout',
          date: '2026-01-02',
          data: {
            name: 'Actual saved session',
            status: 'completed',
            exercises: [],
            notes: 'Optional saved note',
          },
        },
      ],
    },
  };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    const r = await render(FitnessHistoryScreen);
    await press(r, 'Open entry');
    expect(mockNavigate).toHaveBeenCalledWith('FitnessWorkout', {
      kind: 'workout',
      date: '2026-01-02',
      logId: 'original-workout',
      workoutId: 'original-workout',
    });
    await open(r, 'Entry options');
    await press(r, 'Delete entry');
    expect(mockMutation).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][2]![0].style).toBe('cancel');
    await Renderer.act(async () => {
      await (alert.mock.calls[0][2]![1].onPress as any)();
    });
    expect(mockMutation).toHaveBeenCalledWith({
      path: '/logs/workout/original-workout',
      method: 'DELETE',
    });
  } finally {
    alert.mockRestore();
  }
});
test('catalogue missing calorie placeholders stay unknown until explicitly reviewed', async () => {
  mockQueries['/foods/search?q=oats'] = {
    data: {
      foods: [
        {
          barcode: '123',
          name: 'Catalogue oats',
          servingName: '100 g',
          servingGrams: 100,
          nutrients: {
            calories: 0,
            proteinG: 2,
            carbsG: 10,
            fatG: 1,
            fibreG: 0,
          },
          missingNutrients: ['calories'],
        },
      ],
    },
  };
  const r = await render(FitnessMealsScreen);
  await Renderer.act(async () =>
    byLabel(r, FitnessField, 'Search foods').props.onChangeText('oats'),
  );
  await press(r, 'Search foods');
  expect(JSON.stringify(r.toJSON())).toContain('Calories need review');
  expect(JSON.stringify(r.toJSON())).not.toContain('100 g · 0 kcal');
});

async function attemptBack() {
  expect(mockDraftGuard.enabled).toBe(true);
  await Renderer.act(async () =>
    mockDraftGuard.callback({
      data: { action: { type: 'GO_BACK', source: 'draft-route' } },
    }),
  );
}
async function exitChoice(alert: jest.SpyInstance, label = 'Save & leave') {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2];
  await Renderer.act(async () =>
    buttons.find((button: any) => button.text === label).onPress(),
  );
}
test('metric back stays on an invalid draft, retains failed inputs and retries the same request before leaving', async () => {
  mockParams = { kind: 'weight' };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    const r = await render(FitnessLogScreen);
    expect(mockDraftGuard.enabled).toBe(false);
    await open(r, 'More details');
    await Renderer.act(async () =>
      byLabel(r, FitnessField, 'Notes · optional').props.onChangeText(
        'Keep this private note',
      ),
    );
    await attemptBack();
    await exitChoice(alert);
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(r.toJSON())).toContain('Choose a value');
    expect(byLabel(r, FitnessField, 'Notes · optional').props.value).toBe(
      'Keep this private note',
    );
    await Renderer.act(async () =>
      byLabel(r, FitnessStepper, 'Weight').props.onChange(82.5),
    );
    mockMutation.mockRejectedValueOnce(new Error('Offline'));
    await attemptBack();
    await exitChoice(alert);
    const request = mockMutation.mock.calls[0][0];
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(byLabel(r, FitnessStepper, 'Weight').props.value).toBe(82.5);
    await attemptBack();
    await exitChoice(alert);
    expect(mockMutation.mock.calls[1][0]).toEqual(request);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'GO_BACK',
      source: 'draft-route',
    });
  } finally {
    alert.mockRestore();
  }
});
test('an untouched water amount whose save failed still blocks losing its pending request', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    const r = await render(FitnessLogScreen);
    mockMutation.mockRejectedValueOnce(new Error('Lost acknowledgement'));
    await press(r, 'Add 250 ml');
    const request = mockMutation.mock.calls[0][0];
    await attemptBack();
    await exitChoice(alert);
    expect(mockMutation.mock.calls[1][0]).toEqual(request);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});
test('selected meal photos are retained on invalid exit and uploaded privately only after a valid save choice', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    const r = await render(FitnessMealsScreen);
    await Renderer.act(async () =>
      r.root.findByType(FitnessMediaSourceSheet).props.onChoose({
        uri: 'file:///meal-private.jpg',
        name: 'meal.jpg',
        type: 'image/jpeg',
      }),
    );
    await attemptBack();
    await exitChoice(alert);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(r.toJSON())).toContain(
      'Your selected photo is still here',
    );
    await open(r, 'Add custom food');
    await Renderer.act(async () => {
      byLabel(r, FitnessField, 'Food name').props.onChangeText('Actual meal');
      byLabel(r, FitnessStepper, 'Calories (kcal)').props.onChange(120);
    });
    await open(r, 'Nutrition details');
    for (const label of ['Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fibre (g)'])
      await Renderer.act(async () =>
        byLabel(r, FitnessStepper, label).props.onChange(0),
      );
    mockUpload.mockRejectedValueOnce(new Error('Upload offline'));
    await attemptBack();
    await exitChoice(alert);
    const upload = mockUpload.mock.calls[0][0];
    expect(mockDispatch).not.toHaveBeenCalled();
    mockUpload.mockResolvedValueOnce({ id: 'private-photo' });
    await attemptBack();
    await exitChoice(alert);
    expect(mockUpload.mock.calls[1][0]).toEqual(upload);
    expect(mockMutation).toHaveBeenCalledTimes(1);
    expect(mockMutation.mock.calls[0][0]).toMatchObject({
      path: '/logs/meal',
      body: {
        data: {
          foods: [{ name: 'Actual meal', nutrients: { calories: 120 } }],
          mediaIds: ['private-photo'],
        },
      },
    });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});
test('back saves actual unfinished workout sets without inventing planned reps, and failures preserve the editor', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  try {
    const r = await render(FitnessWorkoutScreen);
    await choose(r, 'Activity', 'Walk');
    await press(r, 'Add exercise');
    await Renderer.act(async () => {
      byLabel(r, FitnessField, 'Exercise name').props.onChangeText(
        'Actual squat',
      );
      byLabel(r, FitnessStepper, 'Reps · set 1').props.onChange(5);
    });
    mockMutation.mockRejectedValueOnce(new Error('Lost acknowledgement'));
    await attemptBack();
    await exitChoice(alert);
    const request = mockMutation.mock.calls[0][0];
    expect(request.body.data.exercises).toEqual([
      { name: 'Actual squat', sets: [{ reps: 5 }] },
    ]);
    expect(byLabel(r, FitnessStepper, 'Reps · set 1').props.value).toBe(5);
    expect(mockDispatch).not.toHaveBeenCalled();
    mockMutation.mockImplementation(async (input: any) => ({
      log: {
        id: 'saved-exit',
        kind: 'workout',
        date: input.body.date,
        data: input.body.data,
      },
    }));
    await attemptBack();
    await exitChoice(alert);
    expect(mockMutation.mock.calls[1][0]).toEqual(request);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});

async function invalidateDraft(r: Renderer.ReactTestRenderer, how: string) {
  await Renderer.act(async () => {
    if (how === 'epoch') bumpFitnessDataEpoch();
    else r.unmount();
  });
}
test.each(['epoch', 'unmount'])(
  'meal recipe ACK after %s invalidation cannot upload a photo, post a meal or clear the draft',
  async how => {
    const food = {
      id: 'food-a',
      name: 'Saved oats',
      servingName: 'serving',
      servingGrams: 50,
      source: 'custom',
      nutrients: { calories: 100, proteinG: 2, carbsG: 15, fatG: 2, fibreG: 1 },
    };
    mockQueries['/foods?q=oats'] = { data: { foods: [food] } };
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    try {
      const r = await render(FitnessMealsScreen);
      await Renderer.act(async () =>
        byLabel(r, FitnessField, 'Search foods').props.onChangeText('oats'),
      );
      await press(r, 'Search foods');
      await press(r, 'Add Saved oats');
      await open(r, 'My recipes');
      await press(r, 'Create a recipe');
      await Renderer.act(async () =>
        byLabel(r, FitnessField, 'Recipe name').props.onChangeText(
          'Private recipe',
        ),
      );
      await press(r, 'Add Saved oats');
      await Renderer.act(async () =>
        r.root.findByType(FitnessMediaSourceSheet).props.onChoose({
          uri: 'file:///private.jpg',
          name: 'private.jpg',
          type: 'image/jpeg',
        }),
      );
      let finish!: (value: any) => void;
      mockMutation.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
      await attemptBack();
      await exitChoice(alert);
      expect(mockMutation.mock.calls.map(call => call[0].path)).toEqual([
        '/recipes',
      ]);
      await invalidateDraft(r, how);
      await Renderer.act(async () => finish({}));
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockMutation.mock.calls.map(call => call[0].path)).toEqual([
        '/recipes',
      ]);
      expect(mockDispatch).not.toHaveBeenCalled();
      if (how === 'epoch') {
        expect(byLabel(r, FitnessField, 'Recipe name').props.value).toBe(
          'Private recipe',
        );
        expect(
          byLabel(r, FitnessStepper, 'Portion for Saved oats').props.value,
        ).toBe(1);
      }
    } finally {
      alert.mockRestore();
    }
  },
);
test.each(['epoch', 'unmount'])(
  'workout create ACK after %s invalidation cannot send a lifecycle action',
  async how => {
    let finish!: (value: any) => void;
    mockMutation.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const r = await render(FitnessWorkoutScreen);
    await choose(r, 'Activity', 'Walk');
    await open(r, 'More details');
    await press(r, 'Skip workout');
    const request = mockMutation.mock.calls[0][0];
    await invalidateDraft(r, how);
    await Renderer.act(async () =>
      finish({
        log: {
          id: 'old-created',
          date: request.body.date,
          kind: 'workout',
          data: request.body.data,
        },
      }),
    );
    expect(mockMutation.mock.calls.map(call => call[0].path)).toEqual([
      '/logs/workout',
    ]);
    if (how === 'epoch')
      expect(byLabel(r, FitnessField, 'Workout name').props.value).toBe('Walk');
  },
);
test.each(['epoch', 'unmount'])(
  'workout upload ACK after %s invalidation cannot recreate a workout',
  async how => {
    let finish!: (value: any) => void;
    mockUpload.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const r = await render(FitnessWorkoutScreen);
    await choose(r, 'Activity', 'Walk');
    await Renderer.act(async () =>
      r.root.findByType(FitnessMediaSourceSheet).props.onChoose({
        uri: 'file:///workout.jpg',
        name: 'workout.jpg',
        type: 'image/jpeg',
      }),
    );
    expect(mockUpload).toHaveBeenCalledTimes(1);
    await invalidateDraft(r, how);
    await Renderer.act(async () => finish({ id: 'old-upload' }));
    expect(mockMutation).not.toHaveBeenCalled();
  },
);
test.each(['epoch', 'unmount'])(
  'meal upload ACK after %s invalidation cannot send its photo to AI',
  async how => {
    let finish!: (value: any) => void;
    mockUpload.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const r = await render(FitnessMealsScreen);
    await open(r, 'Add a private meal photo');
    await Renderer.act(async () =>
      r.root.findByType(FitnessMediaSourceSheet).props.onChoose({
        uri: 'file:///meal-ai.jpg',
        name: 'meal.jpg',
        type: 'image/jpeg',
      }),
    );
    await open(r, 'Optional AI estimate');
    await press(r, 'I agree: send photo for an AI estimate');
    await invalidateDraft(r, how);
    await Renderer.act(async () => finish({ id: 'old-private-photo' }));
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  },
);
test('a meal ACK after a purge epoch does not clear or replay the entered foods', async () => {
  mockQueries['/logs/meal'] = {
    data: {
      logs: [
        {
          id: 'previous',
          date: '2026-01-02',
          kind: 'meal',
          data: {
            mealType: 'breakfast',
            foods: [
              {
                name: 'Actual oats',
                servings: 1,
                nutrients: {
                  calories: 100,
                  proteinG: 2,
                  carbsG: 15,
                  fatG: 2,
                  fibreG: 1,
                },
              },
            ],
          },
        },
      ],
    },
  };
  let finish!: (value: any) => void;
  mockMutation.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const r = await render(FitnessMealsScreen);
  await press(r, 'Use foods from breakfast');
  await press(r, 'Save meal');
  await invalidateDraft(r, 'epoch');
  await Renderer.act(async () => finish({}));
  expect(
    byLabel(r, FitnessStepper, 'Portion for Actual oats').props.value,
  ).toBe(1);
  expect(mockMutation).toHaveBeenCalledTimes(1);
  expect(mockDispatch).not.toHaveBeenCalled();
});
test('changing dates never replaces a dirty new workout with a different active session', async () => {
  mockParams = { date: '2026-11-15' };
  mockQueries['/logs/workout'] = {
    data: {
      logs: [
        {
          id: 'old-session',
          date: '2026-11-14',
          kind: 'workout',
          data: { name: 'Old session', status: 'in_progress', exercises: [] },
        },
      ],
    },
  };
  const r = await render(FitnessWorkoutScreen);
  await choose(r, 'Activity', 'Walk');
  await open(r, 'More details');
  await Renderer.act(async () =>
    byLabel(r, FitnessField, 'Workout name').props.onChangeText(
      'Unsaved new workout',
    ),
  );
  await Renderer.act(async () =>
    byLabel(r, FitnessDatePicker, 'Workout date').props.onChange('2026-11-14'),
  );
  expect(byLabel(r, FitnessField, 'Workout name').props.value).toBe(
    'Unsaved new workout',
  );
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockDraftGuard.enabled).toBe(true);
  await press(r, 'Open saved workout for this date');
  expect(mockNavigate).toHaveBeenCalledWith('FitnessWorkout', {
    workoutId: 'old-session',
    date: '2026-11-14',
  });
});

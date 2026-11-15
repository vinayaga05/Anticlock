import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FitnessMealsScreen } from './FitnessMealsScreen';
import { FitnessWorkoutScreen } from './FitnessWorkoutScreen';
import { FitnessPlanScreen } from './FitnessPlanScreen';
import {
  FitnessDisclosure,
  FitnessStepper,
} from '../components/FitnessControls';
import {
  FitnessAction,
  FitnessChoices,
  FitnessField,
} from '../components/FitnessUI';

jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'customer-a' } }),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
const mockMutation = jest.fn();
const mockUpload = jest.fn();
const mockPick = jest.fn();
const mockNavigate = jest.fn();
let mockParams: any = {};
let mockQueries: Record<string, any> = {};
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: jest.fn(),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: any[]) => mockPick(...args),
}));
jest.mock('../fitnessMedia', () => ({
  uploadFitnessMedia: (...args: any[]) => mockUpload(...args),
}));
jest.mock('../components/FitnessPrivateMedia', () => ({
  FitnessPrivateMedia: () => null,
}));
jest.mock('../api/fitnessApi', () => ({
  newFitnessRequestId: () => '00000000-0000-4000-8000-000000000001',
  useFitnessMutation: () => ({ mutateAsync: mockMutation, isPending: false }),
  useFitnessQuery: (path: string, enabled = true) => {
    const found = mockQueries[path] ?? {
      data:
        path === '/profile'
          ? { profile: null }
          : path.startsWith('/logs/')
          ? { logs: [] }
          : path === '/plans'
          ? { plans: [] }
          : path === '/recipes'
          ? { recipes: [] }
          : path.endsWith('/versions')
          ? { versions: [] }
          : { foods: [] },
    };
    return {
      isPending: false,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
      ...found,
      ...(!enabled
        ? { data: undefined, isPending: true, isSuccess: false }
        : {}),
    };
  },
}));
const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
async function render(Component: React.ComponentType) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Component />);
  });
  renderers.push(renderer);
  return renderer;
}
function action(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(FitnessAction)
    .find(item => item.props.label === label)!;
}
function field(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(FitnessField)
    .find(item => item.props.label === label)!;
}
async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    await action(renderer, label).props.onPress();
  });
}
beforeEach(() => {
  mockParams = {};
  mockQueries = {};
  mockMutation.mockReset().mockResolvedValue({});
  mockNavigate.mockReset();
  mockUpload.mockReset();
  mockPick.mockReset();
});
afterEach(() =>
  ReactTestRenderer.act(() => renderers.splice(0).forEach(r => r.unmount())),
);
test('selecting a meal photo neither uploads nor sends it to AI until an explicit action', async () => {
  const r = await render(FitnessMealsScreen);
  await expand(r, 'Add a private meal photo');

  mockPick.mockResolvedValue({
    assets: [
      { uri: 'file:///meal.jpg', type: 'image/jpeg', fileName: 'meal.jpg' },
    ],
  });
  await press(r, 'Choose a meal photo');
  await press(r, 'Choose photo from gallery');
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockMutation).not.toHaveBeenCalled();
  mockUpload.mockResolvedValue({ id: 'media-one' });
  mockMutation.mockResolvedValue({
    estimate: {
      label: 'Estimated meal',
      calories: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 10,
      fibreG: 5,
      notes: 'Review portions',
    },
  });
  await expand(r, 'Optional AI estimate');
  await press(r, 'I agree: send photo for an AI estimate');
  expect(mockMutation).toHaveBeenCalledWith({
    path: '/meals/estimate',
    body: { mediaId: 'media-one', consentToAI: true },
  });
  expect(stepper(r, 'Protein (g)').props.value).toBe(20);
  expect(
    mockMutation.mock.calls.some(([request]) => request.path === '/logs/meal'),
  ).toBe(false);
});
test('meal failures keep editable nutrients and retry the same idempotency key', async () => {
  mockParams = { date: '2026-10-01' };
  const r = await render(FitnessMealsScreen);
  await expand(r, 'Add custom food');
  await ReactTestRenderer.act(async () =>
    field(r, 'Food name').props.onChangeText('Yoghurt'),
  );
  await ReactTestRenderer.act(async () =>
    stepper(r, 'Calories (kcal)').props.onChange(100),
  );
  await expand(r, 'Nutrition details');
  for (const [label, value] of [
    ['Protein (g)', 8],
    ['Carbs (g)', 10],
    ['Fat (g)', 3],
    ['Fibre (g)', 0],
  ] as const)
    await ReactTestRenderer.act(async () =>
      stepper(r, label).props.onChange(value),
    );
  await press(r, 'Add manual food to meal');
  mockMutation.mockRejectedValueOnce(new Error('Network unavailable'));
  await press(r, 'Save meal');
  await expand(r, 'Nutrition & food options');
  expect(stepper(r, 'Yoghurt: Protein (g) per serving').props.value).toBe(8);
  await press(r, 'Save meal');
  const requests = mockMutation.mock.calls
    .filter(([request]) => request.path === '/logs/meal')
    .map(([request]) => request);
  expect(requests).toHaveLength(2);
  expect(requests[0].body.clientRequestId).toBe(
    requests[1].body.clientRequestId,
  );
  expect(requests[1].body).toMatchObject({
    date: '2026-10-01',
    data: {
      foods: [{ name: 'Yoghurt', nutrients: { proteinG: 8, fibreG: 0 } }],
    },
  });
});
test('workout instructions never become fabricated logs and notification date is retained', async () => {
  mockParams = { date: '2026-10-02', day: 5, planId: 'plan-one' };
  mockQueries['/profile'] = {
    data: {
      profile: {
        status: 'complete',
        baseline: { requiresProfessionalReview: false },
      },
    },
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'plan-one',
          currentVersion: 3,
          content: {
            workouts: [
              {
                day: 5,
                name: 'Saved mobility',
                durationMinutes: 20,
                exercises: [{ name: 'Curated stretch', sets: 2, reps: 5 }],
              },
            ],
          },
        },
      ],
    },
  };
  mockMutation.mockImplementation(async (request: any) => ({
    log: {
      id: 'workout-one',
      date: request.body.date ?? '2026-10-02',
      data: request.body.data,
    },
  }));
  const r = await render(FitnessWorkoutScreen);
  await press(r, 'Start workout');
  expect(mockMutation.mock.calls[0][0]).toMatchObject({
    path: '/logs/workout',
    body: {
      date: '2026-10-02',
      data: {
        name: 'Saved mobility',
        exercises: [],
        status: 'in_progress',
        planId: 'plan-one',
        planDay: 5,
        planVersion: 3,
      },
    },
  });
});
test('a failed workout start retries its original timestamp and UUID', async () => {
  mockParams = { date: '2026-10-02' };
  const r = await render(FitnessWorkoutScreen);
  await ReactTestRenderer.act(async () =>
    field(r, 'Workout name').props.onChangeText('My actual walk'),
  );
  mockMutation.mockRejectedValueOnce(new Error('Lost acknowledgement'));
  await press(r, 'Start workout');
  mockMutation.mockImplementation(async (request: any) => ({
    log: { id: 'workout-one', date: '2026-10-02', data: request.body.data },
  }));
  await press(r, 'Start workout');
  expect(mockMutation.mock.calls[0][0].body).toEqual(
    mockMutation.mock.calls[1][0].body,
  );
});
test('manual sessions stay unlinked even when an active plan exists', async () => {
  mockParams = { date: '2026-10-02' };
  mockQueries['/profile'] = {
    data: {
      profile: {
        status: 'complete',
        baseline: { requiresProfessionalReview: false },
      },
    },
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'plan-one',
          currentVersion: 3,
          content: {
            workouts: [{ day: 5, name: 'Scheduled strength', exercises: [] }],
          },
        },
      ],
    },
  };
  mockMutation.mockImplementation(async (request: any) => ({
    log: { id: 'manual-workout', date: '2026-10-02', data: request.body.data },
  }));
  const r = await render(FitnessWorkoutScreen);
  await ReactTestRenderer.act(async () =>
    field(r, 'Workout name').props.onChangeText('My walk'),
  );
  await press(r, 'Start workout');
  const payload = mockMutation.mock.calls[0][0].body.data;
  expect(payload.name).toBe('My walk');
  expect(payload.planId).toBeUndefined();
  expect(payload.planDay).toBeUndefined();
  expect(payload.planVersion).toBeUndefined();
});
test('reopened workouts use the recorded plan version and never an unrelated current plan', async () => {
  mockParams = { workoutId: 'old-workout' };
  mockQueries['/profile'] = {
    data: {
      profile: {
        status: 'complete',
        baseline: { requiresProfessionalReview: false },
      },
    },
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'unrelated-current',
          currentVersion: 9,
          content: {
            workouts: [
              { day: 5, name: 'Unrelated current guidance', exercises: [] },
            ],
          },
        },
      ],
    },
  };
  mockQueries['/logs/workout/old-workout'] = {
    data: {
      log: {
        id: 'old-workout',
        date: '2026-10-02',
        data: {
          name: 'Recorded session',
          status: 'completed',
          exercises: [],
          planId: 'old-plan',
          planDay: 5,
          planVersion: 1,
        },
      },
    },
  };
  mockQueries['/plans/old-plan/versions'] = {
    data: {
      versions: [
        {
          version: 1,
          content: {
            requiresProfessionalReview: false,
            workouts: [
              {
                day: 5,
                name: 'Original saved guidance',
                exercises: [
                  { name: 'Original version exercise', sets: 2, reps: 8 },
                ],
              },
            ],
          },
        },
      ],
    },
  };
  const r = await render(FitnessWorkoutScreen);
  await expand(r, 'Your planned exercises');
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain('Original saved guidance');
  expect(json).toContain('Original version exercise');
  expect(json).not.toContain('Unrelated current guidance');
});
test('a version deep link renders the requested historical content rather than the latest plan', async () => {
  mockParams = { planId: 'plan-one', version: 1 };
  const content = {
    name: 'Latest',
    description: 'Latest description',
    requiresProfessionalReview: false,
    workouts: [],
    nutrition: { guidance: [] },
    habits: [],
    assumptions: [],
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        { id: 'plan-one', title: 'Saved plan', currentVersion: 2, content },
      ],
    },
  };
  mockQueries['/plans/plan-one/versions'] = {
    data: {
      versions: [
        {
          id: 'version-one',
          version: 1,
          content: {
            ...content,
            name: 'Original title',
            description: 'Original saved description',
          },
        },
      ],
    },
  };
  const r = await render(FitnessPlanScreen);
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain('Original saved description');
  expect(json).toContain('Original title');
  expect(json).not.toContain('Latest description');
});
test('provider authored plans retain required professional review and do not supply automatic workout guidance while flagged', async () => {
  const content = {
    name: 'Provider plan',
    description: 'Awaiting appropriate review',
    requiresProfessionalReview: true,
    workouts: [
      {
        day: 1,
        name: 'Awaiting exercise clearance',
        durationMinutes: 30,
        exercises: [{ name: 'Withheld prescription', sets: 3, reps: 10 }],
      },
    ],
    nutrition: { guidance: [] },
    habits: [],
    assumptions: [],
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'provider-plan',
          providerId: 'trainer-one',
          title: 'Provider revision',
          status: 'active',
          currentVersion: 2,
          content,
        },
      ],
    },
  };
  const plan = await render(FitnessPlanScreen);
  expect(JSON.stringify(plan.toJSON())).toContain(
    'Professional review is required',
  );
  expect(JSON.stringify(plan.toJSON())).toContain('not medical clearance');
  expect(JSON.stringify(plan.toJSON())).not.toContain('Withheld prescription');
  mockParams = { day: 1, planId: 'provider-plan' };
  const workout = await render(FitnessWorkoutScreen);
  expect(field(workout, 'Workout name').props.value).toBe('');
  expect(JSON.stringify(workout.toJSON())).not.toContain(
    'Withheld prescription',
  );
});
test('a saved nutrition revision shows its own explicit ranges separately from baseline estimates', async () => {
  const content = {
    name: 'Provider plan',
    description: 'Saved nutrition update',
    requiresProfessionalReview: false,
    workouts: [],
    nutrition: {
      guidance: ['Saved guidance'],
      calories: { min: 1900, max: 2100 },
      targets: {
        proteinG: { min: 100, max: 120 },
        fibreG: { min: 28, max: 32 },
        waterMl: { min: 2200, max: 2500 },
      },
    },
    habits: [],
    assumptions: [],
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'provider-plan',
          providerId: 'nutritionist-one',
          title: 'Nutrition revision',
          status: 'active',
          currentVersion: 2,
          content,
        },
      ],
    },
  };
  const r = await render(FitnessPlanScreen);
  expect(JSON.stringify(r.toJSON())).not.toContain('1900–2100 kcal');
  await ReactTestRenderer.act(async () =>
    r.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Saved nutrition ranges' &&
          n.props.accessibilityRole === 'button',
      )[0]
      .props.onPress(),
  );
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain('1900–2100 kcal');
  expect(json).toContain('100–120 g');
  expect(json).toContain('28–32 g');
  expect(json).toContain('2200–2500 ml');
});

test('current assessment review keeps stale plan actions and numeric estimates withheld after expanding details', async () => {
  mockQueries['/profile'] = {
    data: {
      profile: {
        baseline: {
          requiresProfessionalReview: true,
          calories: { min: 9999, max: 9999 },
        },
      },
    },
  };
  mockQueries['/plans'] = {
    data: {
      plans: [
        {
          id: 'review-plan',
          title: 'Saved plan',
          status: 'active',
          currentVersion: 1,
          content: {
            name: 'Saved plan',
            description: 'Saved description',
            requiresProfessionalReview: false,
            workouts: [
              {
                day: 1,
                name: 'Old prescription',
                durationMinutes: 20,
                exercises: [{ name: 'Old exercise', sets: 2 }],
              },
            ],
            nutrition: { guidance: [], calories: { min: 9999, max: 9999 } },
            habits: [],
            assumptions: [],
          },
        },
      ],
    },
  };
  const r = await render(FitnessPlanScreen);
  expect(JSON.stringify(r.toJSON())).not.toContain('Old exercise');
  expect(
    r.root.findAll(
      n =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === 'Start workout',
    ),
  ).toHaveLength(0);
  for (const label of ['Baseline estimates', 'Saved nutrition ranges']) {
    await ReactTestRenderer.act(async () =>
      r.root
        .findAll(
          n =>
            n.props.accessibilityRole === 'button' &&
            n.props.accessibilityLabel === label,
        )[0]
        .props.onPress(),
    );
  }
  expect(JSON.stringify(r.toJSON())).toContain(
    'Numeric estimates are withheld',
  );
  expect(JSON.stringify(r.toJSON())).not.toContain('9999');
});

function stepper(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(FitnessStepper)
    .find(node => node.props.label === label)!;
}
async function expand(
  renderer: ReactTestRenderer.ReactTestRenderer,
  title: string,
) {
  const disclosure = renderer.root
    .findAllByType(FitnessDisclosure)
    .find(node => node.props.title === title)!;
  const button = disclosure.findAll(
    node =>
      node.props.accessibilityLabel === title &&
      typeof node.props.onPress === 'function',
  )[0];
  await ReactTestRenderer.act(async () => button.props.onPress());
}

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FitnessAssessmentScreen } from './FitnessAssessmentScreen';
import { FitnessMealsScreen } from './FitnessMealsScreen';
import { FitnessWorkoutScreen } from './FitnessWorkoutScreen';
import { FitnessPlanScreen } from './FitnessPlanScreen';
import {
  FitnessAction,
  FitnessChoices,
  FitnessField,
} from '../components/FitnessUI';

const mockMutation = jest.fn();
const mockUpload = jest.fn();
const mockPick = jest.fn();
const mockNavigate = jest.fn();
let mockParams: any = {};
let mockQueries: Record<string, any> = {};
jest.mock('@react-navigation/native', () => ({
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
jest.mock(
  '../fitnessMedia',
  () => ({ uploadFitnessMedia: (...args: any[]) => mockUpload(...args) }),
  { virtual: true },
);
jest.mock(
  '../components/FitnessPrivateMedia',
  () => ({ FitnessPrivateMedia: () => null }),
  { virtual: true },
);
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
test('assessment saves drafts before moving on and retains entered values after failure', async () => {
  const r = await render(FitnessAssessmentScreen);
  await ReactTestRenderer.act(async () => {
    field(r, 'Date of birth').props.onChangeText('1990-04-12');
  });
  mockMutation.mockRejectedValueOnce(new Error('Offline — retry'));
  await press(r, 'Save & continue');
  expect(field(r, 'Date of birth').props.value).toBe('1990-04-12');
  expect(r.toJSON()).toEqual(expect.anything());
  expect(mockMutation.mock.calls[0][0]).toMatchObject({
    path: '/profile',
    method: 'PATCH',
    body: { dateOfBirth: '1990-04-12' },
  });
  await press(r, 'Save & continue');
  expect(
    r.root
      .findAllByType(FitnessChoices)
      .some(item => item.props.label === 'Your goals'),
  ).toBe(true);
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('assessment preserves decimal input and comma separated preferences while saving canonical units', async () => {
  const r = await render(FitnessAssessmentScreen);
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessChoices)
      .find(item => item.props.label === 'Preferred display units')!
      .props.onChange('imperial'),
  );
  await ReactTestRenderer.act(async () =>
    field(r, 'Height (inches)').props.onChangeText('66.'),
  );
  expect(field(r, 'Height (inches)').props.value).toBe('66.');
  await ReactTestRenderer.act(async () =>
    field(r, 'Weight (lb)').props.onChangeText('154.3'),
  );
  await press(r, 'Save draft');
  expect(mockMutation.mock.calls[0][0].body.heightCm).toBeCloseTo(167.64);
  expect(mockMutation.mock.calls[0][0].body.weightKg).toBeCloseTo(69.989, 2);
  await press(r, 'Save & continue');
  await press(r, 'Save & continue');
  await ReactTestRenderer.act(async () =>
    field(r, 'Preferred times').props.onChangeText('Morning, '),
  );
  expect(field(r, 'Preferred times').props.value).toBe('Morning, ');
});
test('changing a previous private risk answer to prefer not to say explicitly removes it on the server', async () => {
  mockQueries['/profile'] = {
    data: {
      profile: {
        assessment: { units: 'metric', pregnant: true, equipment: [] },
      },
    },
  };
  const r = await render(FitnessAssessmentScreen);
  for (let i = 0; i < 4; i++) await press(r, 'Save & continue');
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessChoices)
      .find(
        item => item.props.label === 'Pregnancy or postpartum considerations',
      )!
      .props.onChange('Prefer not to say'),
  );
  await press(r, 'Save draft');
  expect(
    mockMutation.mock.calls[mockMutation.mock.calls.length - 1][0].body
      .pregnant,
  ).toBeNull();
});
test('selecting a meal photo neither uploads nor sends it to AI until an explicit action', async () => {
  const r = await render(FitnessMealsScreen);
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessChoices)
      .find(item => item.props.label === 'Add to your journal')!
      .props.onChange('Photo'),
  );
  mockPick.mockResolvedValue({
    assets: [
      { uri: 'file:///meal.jpg', type: 'image/jpeg', fileName: 'meal.jpg' },
    ],
  });
  await press(r, 'Choose a meal photo');
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
  await press(r, 'I agree: send photo for an AI estimate');
  expect(mockMutation).toHaveBeenCalledWith({
    path: '/meals/estimate',
    body: { mediaId: 'media-one', consentToAI: true },
  });
  expect(field(r, 'Protein (g)').props.value).toBe('20');
  expect(
    mockMutation.mock.calls.some(([request]) => request.path === '/logs/meal'),
  ).toBe(false);
});
test('meal failures keep editable nutrients and retry the same idempotency key', async () => {
  mockParams = { date: '2026-10-01' };
  const r = await render(FitnessMealsScreen);
  await ReactTestRenderer.act(async () =>
    r.root
      .findAllByType(FitnessChoices)
      .find(item => item.props.label === 'Add to your journal')!
      .props.onChange('Manual food'),
  );
  for (const [label, value] of [
    ['Food name', 'Yoghurt'],
    ['Calories (kcal)', '100'],
    ['Protein (g)', '8'],
    ['Carbs (g)', '10'],
    ['Fat (g)', '3'],
    ['Fibre (g)', '0'],
  ])
    await ReactTestRenderer.act(async () =>
      field(r, label).props.onChangeText(value),
    );
  await press(r, 'Add manual food to meal');
  mockMutation.mockRejectedValueOnce(new Error('Network unavailable'));
  await press(r, 'Save meal');
  expect(field(r, 'Yoghurt: Protein (g) per serving').props.value).toBe('8');
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
          content: { ...content, description: 'Original saved description' },
        },
      ],
    },
  };
  const r = await render(FitnessPlanScreen);
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain('Original saved description');
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
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain('1900–2100 kcal');
  expect(json).toContain('100–120 g');
  expect(json).toContain('28–32 g');
  expect(json).toContain('2200–2500 ml');
});

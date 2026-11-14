import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { FitnessExpertsScreen } from './screens/FitnessExpertsScreen';
import { FitnessSharingScreen } from './screens/FitnessSharingScreen';
import { FitnessWorkspaceScreen } from './screens/FitnessWorkspaceScreen';
import { FitnessPlanEditor } from './components/FitnessPlanEditor';
import { FitnessExpertHome } from './components/FitnessExpertHome';

const mockNavigate = jest.fn(),
  mockRefetch = jest.fn(),
  mockMutate = jest.fn().mockResolvedValue({});
const providerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  clientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  resourceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let mockParams: any = {},
  mockData: Record<string, any> = {},
  mockErrors: Record<string, Error> = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('../api/fitnessApi', () => ({
  useFitnessQuery: (path: string) => ({
    data: mockData[path],
    error: mockErrors[path],
    isError: Boolean(mockErrors[path]),
    isLoading: false,
    refetch: mockRefetch,
  }),
  useFitnessMutation: () => ({
    mutateAsync: mockMutate,
    isPending: false,
    error: null,
  }),
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'customer' } }),
}));
jest.mock('@/shared/api/messagesClient', () => ({
  createOrGetChannel: jest.fn(),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock(
  '../components/FitnessPrivateMedia',
  () => ({ FitnessPrivateMedia: () => null }),
  { virtual: true },
);
let tree: TestRenderer.ReactTestRenderer;
async function render(component: React.ReactElement) {
  await act(async () => {
    tree = TestRenderer.create(component);
  });
  return tree!;
}
function button(label: string) {
  return tree.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label,
  )[0];
}
function field(label: string) {
  return tree.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onChangeText === 'function',
  )[0];
}
function checkbox(label: string) {
  return tree.root.findAll(
    n =>
      n.props.accessibilityRole === 'checkbox' &&
      n.props.accessibilityLabel === label,
  )[0];
}
function text() {
  return JSON.stringify(tree.toJSON());
}
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockData = {
    '/experts': { experts: [], nextOffset: null },
    '/consents': { consents: [] },
    '/share-choices': { choices: [] },
    '/workspace': { providers: [], clients: [], consultations: [] },
    '/consultations': { consultations: [] },
  };
  mockErrors = {};
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

it('does not show owner workspace or publishing controls to customers', async () => {
  await render(<FitnessExpertHome />);
  expect(button('Open expert workspace')).toBeUndefined();
  expect(button('Find a trainer or nutritionist')).toBeTruthy();
  await act(async () => tree.unmount());
  await render(<FitnessWorkspaceScreen />);
  expect(text()).toContain('For approved professionals');
  expect(button('Add a Clip')).toBeUndefined();
});
it('shows real empty/error directory states and retry instead of fixtures', async () => {
  await render(<FitnessExpertsScreen />);
  expect(text()).toContain('No matching experts yet');
  mockErrors['/experts'] = new Error('Network unavailable');
  await act(async () => tree.update(<FitnessExpertsScreen />));
  expect(text()).toContain('Network unavailable');
  await act(async () => button('Try again').props.onPress());
  expect(mockRefetch).toHaveBeenCalled();
});
it('routes professional profile and booking through the actual business screens', async () => {
  mockData['/experts'] = {
    experts: [
      {
        id: providerId,
        name: 'Saved expert',
        kind: 'trainer',
        categoryId: 'fitness.personal_trainer',
        categoryLabel: 'Trainer',
        qualifications: ['Approved certificate'],
        qualificationSource: 'approved_application',
        approvedAt: null,
        specialities: ['strength'],
        languages: ['English'],
        modes: ['online'],
        priceFrom: 500,
        rating: null,
        reviewCount: 0,
        city: null,
        area: null,
        avatarUrl: null,
        available: true,
        nextAvailableAt: null,
      },
    ],
    nextOffset: null,
  };
  await render(<FitnessExpertsScreen />);
  await act(async () =>
    button('View profile, services & Clips').props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('BusinessProfile', {
    providerId,
    categoryId: 'fitness.personal_trainer',
  });
  await act(async () => button('Book a consultation').props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('BusinessBooking', {
    providerId,
    categoryId: 'fitness.personal_trainer',
  });
});
it('starts with no shared profile categories and requires a separate explicit confirmation', async () => {
  mockParams = { providerId, providerName: 'Saved expert' };
  await render(<FitnessSharingScreen />);
  expect(checkbox('Profile basics').props.accessibilityState.checked).toBe(
    false,
  );
  expect(
    checkbox('Private health details').props.accessibilityState.checked,
  ).toBe(false);
  await act(async () => checkbox('Profile basics').props.onPress());
  await act(async () => button('Review and confirm sharing').props.onPress());
  expect(mockMutate).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Confirm exactly what you share',
    expect.stringContaining('Profile basics'),
    expect.any(Array),
  );
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () =>
    actions.find((a: any) => a.text === 'Confirm sharing').onPress(),
  );
  expect(mockMutate).toHaveBeenCalledWith({
    path: `/consents/${providerId}`,
    method: 'PUT',
    body: { scopes: ['profile'], resourceIds: [], confirmed: true },
  });
});
it('shares a selected entry without automatically selecting private health or attached media', async () => {
  mockParams = { providerId, resourceType: 'workout', resourceId };
  mockData['/share-choices'] = {
    choices: [
      {
        id: resourceId,
        scope: 'workouts',
        label: 'workout record',
        date: '2026-11-14',
      },
    ],
  };
  await render(<FitnessSharingScreen />);
  expect(
    checkbox('workout record · 2026-11-14').props.accessibilityState.checked,
  ).toBe(true);
  expect(
    checkbox('Private health details').props.accessibilityState.checked,
  ).toBe(false);
  await act(async () => button('Review and confirm sharing').props.onPress());
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () =>
    actions.find((a: any) => a.text === 'Confirm sharing').onPress(),
  );
  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({
      body: {
        scopes: ['workouts'],
        resourceIds: [resourceId],
        confirmed: true,
      },
    }),
  );
});
it('prefills current sharing choices and only revokes after confirmation', async () => {
  mockParams = { providerId };
  mockData['/consents'] = {
    consents: [
      {
        id: 'consent',
        providerId,
        providerName: 'Saved expert',
        scopes: ['goals'],
        resourceIds: [],
        status: 'active',
        grantedAt: '2026-11-14T00:00:00Z',
        revokedAt: null,
      },
    ],
  };
  await render(<FitnessSharingScreen />);
  expect(checkbox('Goals and target').props.accessibilityState.checked).toBe(
    true,
  );
  await act(async () => button("Revoke this expert's access").props.onPress());
  expect(mockMutate).not.toHaveBeenCalled();
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () =>
    actions.find((a: any) => a.text === 'Revoke access').onPress(),
  );
  expect(mockMutate).toHaveBeenCalledWith({
    path: `/consents/${providerId}`,
    method: 'DELETE',
  });
});
it('preserves the approved business identity for owner publishing entry points', async () => {
  mockData['/workspace'] = {
    providers: [
      {
        id: providerId,
        name: 'Saved expert',
        kind: 'trainer',
        canPublish: true,
      },
    ],
    clients: [],
    consultations: [],
  };
  await render(<FitnessWorkspaceScreen />);
  await act(async () => button('Add a Clip').props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ClipComposer', {
    publisherProfileId: providerId,
    publisherProfileType: 'business',
  });
  expect(text()).toContain('No shared clients yet');
});

it('explains why plan revisions wait for a client with no current reviewed plan', async () => {
  const client = {
    providerId,
    userId: clientId,
    displayName: 'Saved client',
    scopes: ['plan_write'],
    resourceIds: [],
    plan: null,
  };
  mockData['/workspace'] = {
    providers: [
      {
        id: providerId,
        name: 'Saved expert',
        kind: 'trainer',
        canPublish: true,
      },
    ],
    clients: [client],
    consultations: [],
  };
  mockData[`/workspace/${providerId}/clients/${clientId}`] = {
    client,
    shared: [],
    plan: null,
  };
  await render(<FitnessWorkspaceScreen />);
  await act(async () => button('View shared information').props.onPress());
  expect(text()).toContain('No current plan to revise');
  expect(text()).toContain('complete or review their assessment');
  expect(button('Review and publish version')).toBeUndefined();
});

function editablePlan() {
  return {
    name: 'Saved training plan',
    description: 'Saved plan',
    requiresProfessionalReview: false,
    workouts: [
      {
        day: 1,
        name: 'Monday routine',
        durationMinutes: 20,
        exercises: [
          {
            name: 'Walk',
            sets: 1,
            durationSeconds: 300,
            restSeconds: 30,
            instructions: 'Comfortable pace',
            substitutions: ['Indoor walk'],
            mediaId: resourceId,
          },
          { name: 'Mobility', sets: 2, reps: 6, instructions: 'Easy range' },
        ],
      },
      {
        day: 3,
        name: 'Wednesday routine',
        durationMinutes: 15,
        exercises: [{ name: 'Chair stand', sets: 2, reps: 8 }],
      },
    ],
    nutrition: {
      guidance: ['Balanced preferred meals'],
      calories: { min: 2000, max: 2400 },
      targets: { proteinG: { min: 60, max: 90 } },
    },
    habits: [],
    assumptions: [],
    baselineTargets: {
      proteinG: { min: 50, max: 80 },
      carbsG: { min: 180, max: 240 },
      fatG: { min: 45, max: 70 },
      fibreG: 25,
      waterMl: 2000,
    },
  };
}
it('loads every exercise, retains multi-day drafts and publishes the complete reviewed routine', async () => {
  const publish = jest.fn().mockResolvedValue({});
  await render(
    <FitnessPlanEditor
      content={editablePlan()}
      version={3}
      kind="trainer"
      onPublish={publish}
    />,
  );
  await act(async () => button('Plan section: workouts').props.onPress());
  expect(field('Exercise 1 name').props.value).toBe('Walk');
  expect(field('Exercise 2 name').props.value).toBe('Mobility');
  expect(field('Exercise 1 rest seconds (optional)').props.value).toBe('30');
  await act(async () => button('Add another exercise').props.onPress());
  await act(async () => {
    field('Exercise 3 name').props.onChangeText('Seated reset');
    field('Exercise 3 sets').props.onChangeText('2');
    field('Exercise 3 reps per set (optional)').props.onChangeText('6');
    field('Exercise 3 duration seconds (optional)').props.onChangeText('30');
    field('Exercise 3 rest seconds (optional)').props.onChangeText('45');
    field('Exercise 3 instructions').props.onChangeText(
      'Gentle controlled movement',
    );
    field('Exercise 3 substitutions (one per line)').props.onChangeText(
      'Chair option\nStanding option',
    );
  });
  await act(async () => button('Workout day: Wed').props.onPress());
  expect(field('Exercise 1 name').props.value).toBe('Chair stand');
  await act(async () => button('Workout day: Mon').props.onPress());
  expect(field('Exercise 3 name').props.value).toBe('Seated reset');
  await act(async () =>
    field('Explain this revision to your client').props.onChangeText(
      'Keep all exercises and add a reset',
    ),
  );
  await act(async () => button('Review and publish version').props.onPress());
  expect(publish).not.toHaveBeenCalled();
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () =>
    actions.find((value: any) => value.text === 'Publish revision').onPress(),
  );
  const revision = publish.mock.calls[0][0];
  expect(revision.expectedVersion).toBe(3);
  expect(revision.workouts).toHaveLength(2);
  expect(revision.workouts[0].exercises).toHaveLength(3);
  expect(revision.workouts[0].exercises[0]).toEqual(
    editablePlan().workouts[0].exercises[0],
  );
  expect(revision.workouts[1]).toEqual(editablePlan().workouts[1]);
  expect(revision.workouts[0].exercises[2]).toMatchObject({
    name: 'Seated reset',
    sets: 2,
    reps: 6,
    durationSeconds: 30,
    restSeconds: 45,
    instructions: 'Gentle controlled movement',
    substitutions: ['Chair option', 'Standing option'],
  });
});
it('publishes intentional provider target pairs and explicitly clears a previous override', async () => {
  const publish = jest.fn().mockResolvedValue({});
  await render(
    <FitnessPlanEditor
      content={editablePlan()}
      version={2}
      kind="nutritionist"
      onPublish={publish}
    />,
  );
  await act(async () => button('Plan section: nutrition').props.onPress());
  expect(field('Protein minimum (g)').props.value).toBe('60');
  expect(field('Carbohydrate minimum (g)').props.value).toBe('');
  expect(text()).toContain('Saved baseline: 180–240 g');
  await act(async () => {
    field('Protein minimum (g)').props.onChangeText('');
    field('Protein maximum (g)').props.onChangeText('');
    field('Drinking water minimum (ml)').props.onChangeText('1800');
    field('Drinking water maximum (ml)').props.onChangeText('2200');
    field('Explain this revision to your client').props.onChangeText(
      'Review water and use baseline protein',
    );
  });
  await act(async () => button('Review and publish version').props.onPress());
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () =>
    actions.find((value: any) => value.text === 'Publish revision').onPress(),
  );
  expect(publish.mock.calls[0][0].nutrition).toMatchObject({
    targets: { waterMl: { min: 1800, max: 2200 } },
    clearTargets: ['proteinG'],
  });
  expect(publish.mock.calls[0][0].nutrition.targets.carbsG).toBeUndefined();
  expect(button('Plan section: workouts')).toBeUndefined();
});
it('keeps partial target edits in the draft and blocks publishing incomplete pairs', async () => {
  const publish = jest.fn();
  await render(
    <FitnessPlanEditor
      content={editablePlan()}
      version={1}
      kind="nutritionist"
      onPublish={publish}
    />,
  );
  await act(async () => button('Plan section: nutrition').props.onPress());
  await act(async () => {
    field('Fibre minimum (g)').props.onChangeText('25');
    field('Explain this revision to your client').props.onChangeText(
      'Review fibre target',
    );
  });
  await act(async () => button('Review and publish version').props.onPress());
  expect(text()).toContain('Enter both fibre limits');
  expect(field('Fibre minimum (g)').props.value).toBe('25');
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});
it('keeps clinical numeric targets and workout prescriptions unavailable in the editor', async () => {
  const content = {
    ...editablePlan(),
    requiresProfessionalReview: true,
    workouts: [],
    nutrition: { guidance: ['Professional review first'], calories: null },
  };
  await render(
    <FitnessPlanEditor
      content={content}
      version={1}
      kind="nutritionist"
      onPublish={jest.fn()}
    />,
  );
  await act(async () => button('Plan section: nutrition').props.onPress());
  expect(field('Protein minimum (g)').props.editable).toBe(false);
  expect(text()).toContain(
    'Numeric nutrition targets and exercise prescriptions remain unavailable',
  );
});

it('prefills saved habit targets and revises sleep without introducing a duplicate key', async () => {
  const publish = jest.fn().mockResolvedValue({});
  const content = {
    ...editablePlan(),
    habits: [
      { key: 'water', label: 'Water', target: 2500, unit: 'ml' },
      { key: 'sleep', label: 'Sleep', target: 7, unit: 'hours' },
    ],
  };
  await render(
    <FitnessPlanEditor
      content={content}
      version={1}
      kind="trainer"
      onPublish={publish}
    />,
  );
  expect(field('Daily water target (ml)').props.value).toBe('2500');
  await act(async () => button('Target habit: sleep').props.onPress());
  expect(field('Daily sleep target (hours)').props.value).toBe('7');
  await act(async () => {
    field('Daily sleep target (hours)').props.onChangeText('8');
    field('Explain this revision to your client').props.onChangeText(
      'Review the existing sleep habit',
    );
  });
  await act(async () => button('Review and publish version').props.onPress());
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () =>
    actions.find((value: any) => value.text === 'Publish revision').onPress(),
  );
  expect(publish.mock.calls[0][0].habits).toEqual([
    { key: 'water', label: 'Water', target: 2500, unit: 'ml' },
    { key: 'sleep', label: 'Sleep', target: 8, unit: 'hours' },
  ]);
});

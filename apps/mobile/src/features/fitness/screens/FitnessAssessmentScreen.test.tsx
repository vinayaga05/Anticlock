import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { FitnessAssessment } from '@anticlock/contracts';
import { FitnessAssessmentScreen } from './FitnessAssessmentScreen';
import {
  FitnessAction,
  FitnessChoices,
  FitnessField,
  FitnessScreen,
} from '../components/FitnessUI';
import {
  FitnessChoiceCards,
  FitnessDatePicker,
  FitnessDayPicker,
  FitnessStepper,
  FitnessToggle,
} from '../components/FitnessControls';

const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockRequest = jest.fn();
const mockMutation = jest.fn();
const mockInvalidate = jest.fn();
const mockClient = { invalidateQueries: mockInvalidate };
let mockUser = { id: 'customer-a' };
let mockToken = 'token-a';
let mockEpoch = 0;
let mockProfiles: Record<string, any>;
let mockPatchError: Error | null = null;
let mockPrevention: any;
const mockEvents: string[] = [];
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    dispatch: mockDispatch,
    replace: mockReplace,
    navigate: mockNavigate,
    canGoBack: () => true,
  }),
  usePreventRemove: (prevent: boolean, callback: unknown) => {
    mockPrevention = { prevent, callback };
  },
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClient,
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/shared/api/client', () => ({ getApiToken: () => mockToken }));
jest.mock('../fitnessSession', () => ({
  useFitnessDataEpoch: () => mockEpoch,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icons: Record<string, unknown> = {};
  return new Proxy(
    { __esModule: true },
    {
      get(target, key: string) {
        if (key === '__esModule') return true;
        if (!icons[key])
          icons[key] = (props: unknown) =>
            React.createElement('test-icon', props);
        return icons[key];
      },
    },
  );
});
jest.mock('../components/FitnessVisuals', () => {
  const React = require('react');
  return {
    FitnessPhoto: (props: unknown) => React.createElement('test-photo', props),
    FitnessIllustration: (props: unknown) =>
      React.createElement('test-illustration', props),
  };
});
jest.mock('../api/fitnessApi', () => ({
  fitnessRequest: (...args: unknown[]) => mockRequest(...args),
  useFitnessMutation: () => ({ mutateAsync: mockMutation, isPending: false }),
}));

const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
function stored(
  assessment: FitnessAssessment,
  status = 'draft',
  baseline: unknown = null,
) {
  return {
    id: 'profile-a',
    assessment,
    status,
    baseline,
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
    completedAt: null,
  };
}
function text(node: any): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return (node?.children ?? [])
    .map(text)
    .join(node?.type === 'Text' ? '' : '\n');
}
async function ticks() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}
async function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<FitnessAssessmentScreen />);
    await ticks();
  });
  renderers.push(renderer);
  return renderer;
}
function action(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(FitnessAction)
    .find(node => node.props.label === label)!;
}
function choice(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(FitnessChoices)
    .find(node => node.props.label === label)!;
}
function stepper(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(FitnessStepper)
    .find(node => node.props.label === label)!;
}
async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    action(renderer, label).props.onPress();
    await ticks();
  });
}
async function change(run: () => void) {
  await ReactTestRenderer.act(async () => {
    run();
    await ticks();
  });
}
async function disclosure(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await change(() =>
    renderer.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress(),
  );
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-15T08:00:00Z'));
  mockUser = { id: 'customer-a' };
  mockToken = 'token-a';
  mockEpoch = 0;
  mockProfiles = { 'customer-a': null };
  mockPatchError = null;
  mockEvents.length = 0;
  [mockGoBack, mockDispatch, mockReplace, mockNavigate, mockInvalidate].forEach(
    mock => mock.mockReset(),
  );
  mockRequest.mockReset().mockImplementation(async (path, init, session) => {
    mockEvents.push(`${init.method ?? 'GET'} ${path}`);
    if (init.method === 'PATCH') {
      if (mockPatchError) {
        const error = mockPatchError;
        mockPatchError = null;
        throw error;
      }
      const assessment = {
        ...(mockProfiles[session.userId]?.assessment ?? {}),
      };
      for (const [key, value] of Object.entries(JSON.parse(init.body))) {
        if (value === null) delete assessment[key];
        else assessment[key] = value;
      }
      mockProfiles[session.userId] = stored(assessment);
    }
    return {
      profile: mockProfiles[session.userId]
        ? JSON.parse(JSON.stringify(mockProfiles[session.userId]))
        : null,
    };
  });
  mockMutation.mockReset().mockImplementation(async request => {
    mockEvents.push(`POST ${request.path}`);
    return {};
  });
});
afterEach(() => {
  ReactTestRenderer.act(() =>
    renderers.splice(0).forEach(renderer => renderer.unmount()),
  );
  jest.useRealTimers();
});

test('starts with six visual goals, no early validation and one fixed primary action', async () => {
  const r = await render();
  const cards = r.root.findByType(FitnessChoiceCards);
  expect(cards.props.options.map((option: any) => option.label)).toEqual([
    'Lose Weight',
    'Build Muscle',
    'Stay Fit',
    'Improve Strength',
    'Improve Flexibility',
    'Eat Healthier',
  ]);
  expect(text(r.toJSON())).not.toContain('Choose at least one goal.');
  expect(r.root.findByType(FitnessScreen).props.footer).toBeTruthy();
  await press(r, 'Continue');
  expect(text(r.toJSON())).toContain('Choose at least one goal.');
  await change(() => cards.props.onChange(['balanced_nutrition']));
  await ReactTestRenderer.act(async () => {
    const go = action(r, 'Continue').props.onPress;
    go();
    go();
    await ticks();
  });
  expect(r.root.findByType(FitnessScreen).props.title).toBe('Basic details');
  expect(stepper(r, 'Height').props.value).toBeUndefined();
  expect(stepper(r, 'Current weight').props.value).toBeUndefined();
});
test('date picker and imperial steppers save canonical values and back keeps the answers', async () => {
  const r = await render();
  await change(() =>
    r.root.findByType(FitnessChoiceCards).props.onChange(['strength']),
  );
  await press(r, 'Continue');
  await change(() => choice(r, 'Units').props.onChange('ft-in / lb'));
  await change(() =>
    r.root
      .findAllByType(FitnessDatePicker)
      .find(node => node.props.label === 'Date of birth')!
      .props.onChange('1990-04-12'),
  );
  await change(() => stepper(r, 'Height').props.onChange(66));
  await change(() => stepper(r, 'Current weight').props.onChange(154.3));
  await disclosure(r, 'Gender & body type');
  await change(() => choice(r, 'Gender').props.onChange('Woman'));
  await ReactTestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(650);
  });
  expect(mockProfiles['customer-a'].assessment.heightCm).toBeCloseTo(167.64);
  expect(mockProfiles['customer-a'].assessment.weightKg).toBeCloseTo(69.989, 2);
  expect(mockProfiles['customer-a'].assessment.dateOfBirth).toBe('1990-04-12');
  expect(mockProfiles['customer-a'].assessment.calculationSex).toBe(
    'unspecified',
  );
  await change(() => r.root.findByType(FitnessScreen).props.onBack());
  await press(r, 'Continue');
  expect(stepper(r, 'Height').props.value).toBeCloseTo(66);
  expect(stepper(r, 'Current weight').props.value).toBeCloseTo(154.3);
});
test('five steps create only after flushing the latest draft and never invent review targets', async () => {
  const r = await render();
  await change(() =>
    r.root
      .findByType(FitnessChoiceCards)
      .props.onChange(['balanced_nutrition']),
  );
  await press(r, 'Continue');
  await change(() =>
    r.root
      .findAllByType(FitnessDatePicker)
      .find(node => node.props.label === 'Date of birth')!
      .props.onChange('1990-01-01'),
  );
  await change(() => stepper(r, 'Height').props.onChange(170));
  await change(() => stepper(r, 'Current weight').props.onChange(70));
  await press(r, 'Continue');
  await change(() =>
    r.root.findByType(FitnessChoiceCards).props.onChange(['light']),
  );
  await change(() =>
    choice(r, 'Fitness experience').props.onChange('Beginner'),
  );
  await change(() => choice(r, 'Workout location').props.onChange('Gym'));
  await change(() =>
    r.root.findByType(FitnessDayPicker).props.onChange([1, 3, 5]),
  );
  await change(() => choice(r, 'Session length').props.onChange('30 min'));
  await press(r, 'Continue');
  expect(r.root.findAllByType(FitnessField)).toHaveLength(0);
  await change(() =>
    r.root.findByType(FitnessChoiceCards).props.onChange(['vegetarian']),
  );
  await press(r, 'Continue');
  expect(r.root.findByType(FitnessScreen).props.title).toBe(
    'Ready for your plan',
  );
  expect(text(r.toJSON())).toContain(
    'Your daily targets are personalized after review.',
  );
  expect(text(r.toJSON())).not.toContain('kcal');
  await press(r, 'Create My Plan');
  expect(mockMutation).not.toHaveBeenCalled();
  await change(() => r.root.findByType(FitnessToggle).props.onChange(true));
  await press(r, 'Create My Plan');
  expect(mockEvents.slice(-3)).toEqual([
    'PATCH /profile',
    'POST /profile/complete',
    'POST /plans/generate',
  ]);
  expect(mockReplace).toHaveBeenCalledWith('FitnessHome');
  expect(mockProfiles['customer-a'].assessment).toMatchObject({
    goals: ['balanced_nutrition'],
    foodPreferences: ['vegetarian'],
    exercisePreferences: ['location:gym'],
    disclaimerAccepted: true,
    heightCm: 170,
    weightKg: 70,
  });
});
test('back flush failure retains the latest answers and retry precedes leaving', async () => {
  const r = await render();
  await change(() =>
    r.root
      .findByType(FitnessChoiceCards)
      .props.onChange(['balanced_nutrition']),
  );
  mockPatchError = new Error('Offline — your answers are still here');
  await change(() => r.root.findByType(FitnessScreen).props.onBack());
  expect(mockGoBack).not.toHaveBeenCalled();
  expect(r.root.findByType(FitnessChoiceCards).props.value).toEqual([
    'balanced_nutrition',
  ]);
  expect(text(r.toJSON())).toContain('Offline');
  await change(() => r.root.findByType(FitnessScreen).props.onBack());
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(mockProfiles['customer-a'].assessment.goals).toEqual([
    'balanced_nutrition',
  ]);
});
test('optional health concerns stay collapsed and a saved answer can be explicitly removed', async () => {
  mockProfiles['customer-a'] = stored({
    goals: ['rehabilitation_support'],
    dateOfBirth: '1990-01-01',
    heightCm: 170,
    weightKg: 70,
    activityLevel: 'light',
    experience: 'beginner',
    availableDays: [1],
    equipment: [],
    foodPreferences: ['halal'],
    pregnant: true,
    medicalConditions: 'Private saved context',
    exercisePreferences: ['yoga'],
  });
  const r = await render();
  await press(r, 'Continue');
  await press(r, 'Continue');
  await change(() => choice(r, 'Workout location').props.onChange('Outdoor'));
  await press(r, 'Continue');
  expect(r.root.findAllByType(FitnessField)).toHaveLength(0);
  await disclosure(r, 'Anything we should consider?');
  expect(
    r.root
      .findAllByType(FitnessField)
      .some(field => field.props.label === 'Health concerns'),
  ).toBe(false);
  await disclosure(r, 'Injury or health concerns');
  await change(() =>
    choice(r, 'Pregnancy or postpartum').props.onChange('Prefer not to say'),
  );
  await ReactTestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(650);
  });
  const patch = mockRequest.mock.calls
    .filter(([, init]) => init.method === 'PATCH')
    .map(([, init]) => JSON.parse(init.body))
    .find(body => Object.prototype.hasOwnProperty.call(body, 'pregnant'));
  expect(patch.pregnant).toBeNull();
  expect(mockProfiles['customer-a'].assessment.medicalConditions).toBe(
    'Private saved context',
  );
  expect(mockProfiles['customer-a'].assessment.exercisePreferences).toEqual([
    'yoga',
    'location:outdoor',
  ]);
  expect(mockProfiles['customer-a'].assessment.foodPreferences).toEqual([
    'halal',
  ]);
});
test('review uses a current server baseline and hides it immediately after an answer changes', async () => {
  mockProfiles['customer-a'] = stored(
    {
      goals: ['strength'],
      dateOfBirth: '1990-01-01',
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'light',
      experience: 'beginner',
      availableDays: [1],
      equipment: [],
      foodPreferences: ['vegetarian'],
      disclaimerAccepted: true,
    },
    'complete',
    {
      requiresProfessionalReview: false,
      calories: { min: 1800, max: 2100 },
      proteinG: null,
      waterMl: 2000,
    },
  );
  const r = await render();
  for (let index = 0; index < 4; index++) await press(r, 'Continue');
  expect(text(r.toJSON())).toContain('1800–2100 kcal');
  for (let index = 0; index < 3; index++)
    await change(() => r.root.findByType(FitnessScreen).props.onBack());
  await change(() => stepper(r, 'Current weight').props.onChange(72));
  for (let index = 0; index < 3; index++) await press(r, 'Continue');
  expect(text(r.toJSON())).not.toContain('1800–2100 kcal');
  expect(text(r.toJSON())).toContain(
    'Your daily targets are personalized after review.',
  );
});

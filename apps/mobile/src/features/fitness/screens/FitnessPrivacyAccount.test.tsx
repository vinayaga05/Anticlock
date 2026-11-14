import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { FitnessPrivacyScreen } from './FitnessPrivacyScreen';
import { FitnessAction, FitnessField } from '../components/FitnessUI';

const mockClose = jest.fn();
const mockLogout = jest.fn();
const mockCancel = jest.fn();
const mockRemove = jest.fn();
const mockBump = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    cancelQueries: mockCancel,
    removeQueries: mockRemove,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'customer-a' }, logout: mockLogout }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../fitnessMedia', () => ({ uploadFitnessMedia: jest.fn() }));
jest.mock('../components/FitnessPrivateMedia', () => ({
  FitnessPrivateMedia: () => null,
}));
jest.mock('../fitnessSession', () => ({
  bumpFitnessDataEpoch: () => mockBump(),
}));
jest.mock('../api/fitnessAccount', () => ({
  closeFitnessAccount: (...args: any[]) => mockClose(...args),
}));
jest.mock('../api/fitnessApi', () => ({
  newFitnessRequestId: () => '00000000-0000-4000-8000-000000000001',
  useFitnessMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useFitnessQuery: (path: string) => ({
    data:
      path === '/profile'
        ? {
            profile: {
              assessment: {
                reminders: {
                  enabled: false,
                  workouts: false,
                  meals: false,
                  water: false,
                  habits: false,
                  weeklySummary: false,
                  workoutTime: '08:30',
                },
              },
            },
          }
        : { media: [] },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));
let renderer: ReactTestRenderer.ReactTestRenderer;
let alert: jest.SpyInstance;
beforeEach(() => {
  mockClose.mockReset();
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockCancel.mockReset();
  mockRemove.mockReset();
  mockBump.mockReset();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  ReactTestRenderer.act(() => renderer?.unmount());
  alert.mockRestore();
});
async function render() {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<FitnessPrivacyScreen />);
  });
}
test('account closure needs explicit confirmation and then clears private caches and drafts', async () => {
  mockClose.mockImplementation(async (_userId, cleanup) => {
    await cleanup.logout();
    cleanup.clearPrivateState();
    return { accountClosed: true, fitnessDataDeleted: true };
  });
  await render();
  await ReactTestRenderer.act(async () =>
    renderer.root
      .findAllByType(FitnessAction)
      .find(action => action.props.label === 'Close my Anticlock account')!
      .props.onPress(),
  );
  expect(mockClose).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][1]).toContain(
    'Booking, chat and other records may be retained',
  );
  const buttons = alert.mock.calls[0][2];
  expect(buttons[0].style).toBe('cancel');
  await ReactTestRenderer.act(async () => {
    await buttons[1].onPress();
  });
  expect(mockClose).toHaveBeenCalledWith(
    'customer-a',
    expect.objectContaining({
      logout: mockLogout,
      clearPrivateState: expect.any(Function),
    }),
  );
  expect(mockCancel).toHaveBeenCalledWith({ queryKey: ['fitness'] });
  expect(mockRemove).toHaveBeenCalledWith({ queryKey: ['fitness'] });
  expect(mockBump).toHaveBeenCalledTimes(1);
});
test('closure failure leaves reminder edits and the signed in session available for retry', async () => {
  mockClose.mockRejectedValue(new Error('Account service unavailable'));
  await render();
  const time = () =>
    renderer.root
      .findAllByType(FitnessField)
      .find(field => field.props.label === 'Workout time')!;
  await ReactTestRenderer.act(async () => time().props.onChangeText('09:15'));
  await ReactTestRenderer.act(async () =>
    renderer.root
      .findAllByType(FitnessAction)
      .find(action => action.props.label === 'Close my Anticlock account')!
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () => {
    await alert.mock.calls[0][2][1].onPress();
  });
  expect(time().props.value).toBe('09:15');
  expect(mockLogout).not.toHaveBeenCalled();
  expect(mockRemove).not.toHaveBeenCalled();
  expect(mockBump).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Account service unavailable',
  );
});

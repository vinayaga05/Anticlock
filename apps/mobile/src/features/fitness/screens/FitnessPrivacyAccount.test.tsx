import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Share } from 'react-native';
import { FitnessMediaSourceSheet } from '../components/FitnessMediaSourceSheet';
import { FitnessPrivacyScreen } from './FitnessPrivacyScreen';
import { FitnessAction } from '../components/FitnessUI';
import {
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessToggle,
} from '../components/FitnessControls';

const mockClose = jest.fn();
const mockUpload = jest.fn(),
  mockRequest = jest.fn(),
  mockRefetch = jest.fn();
const mockMutation = jest.fn(),
  mockDispatch = jest.fn();
let mockDraftGuard: { enabled: boolean; callback: (event: any) => void };
const mockLogout = jest.fn();
const mockCancel = jest.fn();
const mockRemove = jest.fn();
const mockBump = jest.fn();
jest.mock('@react-navigation/native', () => ({
  StackActions: {
    replace: (name: string) => ({ type: 'REPLACE', payload: { name } }),
  },
  usePreventRemove: (enabled: boolean, callback: (event: any) => void) => {
    mockDraftGuard = { enabled, callback };
  },
  useNavigation: () => ({
    navigate: jest.fn(),
    dispatch: mockDispatch,
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
jest.mock('../fitnessMedia', () => ({
  uploadFitnessMedia: (...args: any[]) => mockUpload(...args),
}));
jest.mock('../components/FitnessPrivateMedia', () => ({
  FitnessPrivateMedia: () => null,
}));
jest.mock('../fitnessSession', () => ({
  bumpFitnessDataEpoch: () => mockBump(),
  useFitnessDataEpoch: () => 0,
  getFitnessDataEpoch: () => 0,
}));
jest.mock('../api/fitnessAccount', () => ({
  closeFitnessAccount: (...args: any[]) => mockClose(...args),
}));
jest.mock('../api/fitnessApi', () => ({
  fitnessRequest: (...args: any[]) => mockRequest(...args),
  newFitnessRequestId: () => '00000000-0000-4000-8000-000000000001',
  useFitnessMutation: () => ({ mutateAsync: mockMutation, isPending: false }),
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
    refetch: mockRefetch,
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
  mockMutation.mockReset().mockResolvedValue({});
  mockDispatch.mockReset();
  mockUpload.mockReset();
  mockRequest.mockReset();
  mockRefetch.mockReset().mockResolvedValue({});
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
  await expand('Your data & account');
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
  await expand('Reminders');
  await toggle('Fitness reminders', true);
  await toggle('Workout', true);
  const time = () =>
    renderer.root
      .findAllByType(FitnessDatePicker)
      .find(field => field.props.label === 'Workout time')!;
  await ReactTestRenderer.act(async () => time().props.onChange('09:15'));
  await expand('Your data & account');
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

async function expand(title: string) {
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
async function toggle(label: string, value: boolean) {
  await ReactTestRenderer.act(async () =>
    renderer.root
      .findAllByType(FitnessToggle)
      .find(node => node.props.label === label)!
      .props.onChange(value),
  );
}

test('back preserves changed reminder times until their private save succeeds', async () => {
  await render();
  expect(mockDraftGuard.enabled).toBe(false);
  await expand('Reminders');
  await toggle('Fitness reminders', true);
  await toggle('Workout', true);
  const time = () =>
    renderer.root
      .findAllByType(FitnessDatePicker)
      .find(node => node.props.label === 'Workout time')!;
  await ReactTestRenderer.act(async () => time().props.onChange('09:15'));
  const back = async () =>
    ReactTestRenderer.act(async () =>
      mockDraftGuard.callback({ data: { action: { type: 'GO_BACK' } } }),
    );
  const save = async () =>
    ReactTestRenderer.act(async () =>
      alert.mock.calls[alert.mock.calls.length - 1][2]
        .find((button: any) => button.text === 'Save & leave')
        .onPress(),
    );
  mockMutation.mockRejectedValueOnce(new Error('Offline'));
  await back();
  await save();
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(time().props.value).toBe('09:15');
  await back();
  await save();
  expect(mockMutation.mock.calls[1][0]).toEqual(mockMutation.mock.calls[0][0]);
  expect(mockMutation.mock.calls[1][0]).toMatchObject({
    path: '/profile',
    method: 'PATCH',
    body: {
      reminders: {
        enabled: true,
        workouts: true,
        workoutTime: '09:15',
        meals: false,
        water: false,
      },
    },
  });
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});

test('a late progress-photo upload ACK cannot reload private media from an unmounted route', async () => {
  let finish!: (value: any) => void;
  mockUpload.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await render();
  await ReactTestRenderer.act(async () =>
    renderer.root.findByType(FitnessMediaSourceSheet).props.onChoose({
      uri: 'file:///old-progress.jpg',
      name: 'old-progress.jpg',
      type: 'image/jpeg',
    }),
  );
  expect(mockUpload).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
  await ReactTestRenderer.act(async () => finish({ id: 'old-private-upload' }));
  expect(mockRefetch).not.toHaveBeenCalled();
  expect(mockMutation).not.toHaveBeenCalled();
});
test('a late export response cannot open the system share sheet after its private route unmounts', async () => {
  let finish!: (value: any) => void;
  mockRequest.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.dismissedAction });
  try {
    await render();
    await expand('Your data & account');
    await ReactTestRenderer.act(async () =>
      renderer.root
        .findAllByType(FitnessAction)
        .find(node => node.props.label === 'Export my private fitness data')!
        .props.onPress(),
    );
    expect(mockRequest).toHaveBeenCalledWith('/export');
    await ReactTestRenderer.act(async () => renderer.unmount());
    await ReactTestRenderer.act(async () =>
      finish({ privateData: 'old-owner' }),
    );
    expect(share).not.toHaveBeenCalled();
  } finally {
    share.mockRestore();
  }
});

import React from 'react';
import Renderer from 'react-test-renderer';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationSetup } from './useNotificationSetup';
import * as notifications from '../services/notificationService';
import { navigateFromNotification } from '@/shared/navigation/rootNavigation';

const mockRegisterRequest = jest.fn();
const mockUnregisterRequest = jest.fn();
jest.mock('../api/notificationHooks', () => ({
  // Use real mutation observers: pending/success produce fresh result objects.
  useRegisterDeviceToken: () =>
    require('@tanstack/react-query').useMutation({
      mutationFn: mockRegisterRequest,
    }),
  useUnregisterDeviceToken: () =>
    require('@tanstack/react-query').useMutation({
      mutationFn: mockUnregisterRequest,
    }),
}));
jest.mock('../services/notificationService', () => ({
  requestNotificationPermission: jest.fn(),
  getDeviceToken: jest.fn(),
  setForegroundNotificationHandler: jest.fn(),
  setBackgroundNotificationHandler: jest.fn(),
  setTokenRefreshHandler: jest.fn(),
  deleteDeviceToken: jest.fn(),
}));
jest.mock('@/shared/navigation/rootNavigation', () => ({
  navigateFromNotification: jest.fn(),
}));

const service = jest.mocked(notifications);
const unsubscribeForeground = jest.fn();
const unsubscribeBackground = jest.fn();
const unsubscribeRefresh = jest.fn();
const removeAppState = jest.fn();
let tree: Renderer.ReactTestRenderer;
let client: QueryClient;
function Probe({ authenticated }: { authenticated: boolean }) {
  useNotificationSetup(authenticated);
  return null;
}
const app = (authenticated: boolean) => (
  <QueryClientProvider client={client}>
    <Probe authenticated={authenticated} />
  </QueryClientProvider>
);
const flush = async () => {
  // Exercise React Query's batched mutation notifications without real sleeps.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await Renderer.act(async () => {
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
  }
};
const render = async (authenticated = true) => {
  await Renderer.act(async () => {
    tree = Renderer.create(app(authenticated));
  });
  await flush();
};
const update = async (authenticated = true) => {
  await Renderer.act(async () => tree.update(app(authenticated)));
  await flush();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  mockRegisterRequest.mockResolvedValue({ success: true });
  mockUnregisterRequest.mockResolvedValue({ success: true });
  service.requestNotificationPermission.mockResolvedValue(true);
  service.getDeviceToken.mockResolvedValue('test-device-token');
  service.deleteDeviceToken.mockResolvedValue();
  service.setForegroundNotificationHandler.mockReturnValue(
    unsubscribeForeground,
  );
  service.setBackgroundNotificationHandler.mockReturnValue(
    unsubscribeBackground,
  );
  service.setTokenRefreshHandler.mockReturnValue(unsubscribeRefresh);
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: removeAppState });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.mocked(navigateFromNotification).mockReturnValue(true);
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  client.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('acquires and registers once despite mutation state updates and app root rerenders', async () => {
  await render();
  await update();
  await update();
  expect(service.requestNotificationPermission).toHaveBeenCalledTimes(1);
  expect(service.getDeviceToken).toHaveBeenCalledTimes(1);
  expect(mockRegisterRequest).toHaveBeenCalledTimes(1);
  expect(mockRegisterRequest).toHaveBeenCalledWith(
    {
      token: 'test-device-token',
      platform: 'ios',
    },
    expect.anything(),
  );
  expect(service.setForegroundNotificationHandler).toHaveBeenCalledTimes(1);
  expect(service.setBackgroundNotificationHandler).toHaveBeenCalledTimes(1);
  expect(service.setTokenRefreshHandler).toHaveBeenCalledTimes(1);
  expect(unsubscribeForeground).not.toHaveBeenCalled();
});

it('does not continue permission setup after logout, and can set up a later login', async () => {
  const permission = deferred<boolean>();
  service.requestNotificationPermission.mockReturnValueOnce(permission.promise);
  await render();
  await update(false);
  await Renderer.act(async () => permission.resolve(true));
  await flush();
  expect(service.getDeviceToken).not.toHaveBeenCalled();
  expect(mockRegisterRequest).not.toHaveBeenCalled();
  expect(service.setForegroundNotificationHandler).not.toHaveBeenCalled();
  await update(true);
  expect(service.requestNotificationPermission).toHaveBeenCalledTimes(2);
  expect(service.getDeviceToken).toHaveBeenCalledTimes(1);
  expect(mockRegisterRequest).toHaveBeenCalledTimes(1);
});

it('does not register or attach listeners after unmount while acquiring a token', async () => {
  const token = deferred<string | null>();
  service.getDeviceToken.mockReturnValueOnce(token.promise);
  await render();
  Renderer.act(() => tree.unmount());
  await Renderer.act(async () => token.resolve('late-token'));
  await flush();
  expect(mockRegisterRequest).not.toHaveBeenCalled();
  expect(service.setForegroundNotificationHandler).not.toHaveBeenCalled();
  expect(service.setBackgroundNotificationHandler).not.toHaveBeenCalled();
  expect(service.setTokenRefreshHandler).not.toHaveBeenCalled();
  expect(removeAppState).toHaveBeenCalledTimes(1);
});

it('unsubscribes all handlers, unregisters once on logout and ignores stale refresh/navigation retries', async () => {
  await render();
  const refresh = service.setTokenRefreshHandler.mock.calls[0][0];
  const background = service.setBackgroundNotificationHandler.mock.calls[0][0];
  jest.mocked(navigateFromNotification).mockReturnValue(false);
  Renderer.act(() => background({ kind: 'booking' }));
  expect(navigateFromNotification).toHaveBeenCalledTimes(1);
  // Logout before the pending cold-start navigation retry can run.
  Renderer.act(() => tree.update(app(false)));
  Renderer.act(() => refresh('stale-token'));
  await flush();
  await update(false);
  expect(unsubscribeForeground).toHaveBeenCalledTimes(1);
  expect(unsubscribeBackground).toHaveBeenCalledTimes(1);
  expect(unsubscribeRefresh).toHaveBeenCalledTimes(1);
  expect(removeAppState).toHaveBeenCalledTimes(1);
  expect(mockUnregisterRequest).toHaveBeenCalledTimes(1);
  expect(service.deleteDeviceToken).toHaveBeenCalledTimes(1);
  expect(mockRegisterRequest).toHaveBeenCalledTimes(1);
  expect(navigateFromNotification).toHaveBeenCalledTimes(1);
});

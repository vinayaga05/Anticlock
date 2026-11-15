import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { useFitnessDraftGuard } from './useFitnessDraftGuard';
let mockUser = 'owner-a',
  mockToken = 'token-a',
  mockEpoch = 0;
let mockGuard: { enabled: boolean; callback: (event: any) => void };
const mockDispatch = jest.fn(),
  mockSave = jest.fn(),
  mockError = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (enabled: boolean, callback: (event: any) => void) => {
    mockGuard = { enabled, callback };
  },
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: mockUser } }),
}));
jest.mock('@/shared/api/client', () => ({ getApiToken: () => mockToken }));
jest.mock('../fitnessSession', () => ({
  useFitnessDataEpoch: () => mockEpoch,
  getFitnessDataEpoch: () => mockEpoch,
}));
let exposed: ReturnType<typeof useFitnessDraftGuard>;
function Draft({
  dirty = true,
  busy = false,
}: {
  dirty?: boolean;
  busy?: boolean;
}) {
  exposed = useFitnessDraftGuard({
    dirty,
    busy,
    save: mockSave,
    onError: mockError,
  });
  return null;
}
let renderer: Renderer.ReactTestRenderer, alert: jest.SpyInstance;
const action = { type: 'GO_BACK', source: 'private-draft' };
async function render(props = {}) {
  await Renderer.act(async () => {
    renderer = Renderer.create(<Draft {...props} />);
  });
}
async function back() {
  await Renderer.act(async () => mockGuard.callback({ data: { action } }));
}
async function button(label: string) {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2];
  await Renderer.act(async () =>
    buttons.find((item: any) => item.text === label).onPress(),
  );
}
beforeEach(() => {
  mockUser = 'owner-a';
  mockToken = 'token-a';
  mockEpoch = 0;
  mockDispatch
    .mockReset()
    .mockImplementation(() => expect(mockGuard.enabled).toBe(false));
  mockSave.mockReset().mockResolvedValue(true);
  mockError.mockReset();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  Renderer.act(() => renderer?.unmount());
  alert.mockRestore();
});
test('clean drafts allow back; dirty drafts stay until an explicit choice', async () => {
  await render({ dirty: false });
  expect(mockGuard.enabled).toBe(false);
  await Renderer.act(async () => renderer.update(<Draft />));
  expect(mockGuard.enabled).toBe(true);
  await back();
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
  await button('Stay');
  expect(mockGuard.enabled).toBe(true);
  expect(mockSave).not.toHaveBeenCalled();
});
test('Save and leave waits for acknowledgement and bypasses its own guard exactly once', async () => {
  let finish!: (saved: boolean) => void;
  mockSave.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await render();
  await back();
  await button('Save & leave');
  expect(exposed.saving).toBe(true);
  expect(mockDispatch).not.toHaveBeenCalled();
  await back();
  expect(alert).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => finish(true));
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(action);
});
test('invalid and failed saves keep the guard active and permit a safe retry', async () => {
  await render();
  mockSave
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new Error('Offline'));
  for (let i = 0; i < 2; i++) {
    await back();
    await button('Save & leave');
    expect(mockGuard.enabled).toBe(true);
    expect(mockDispatch).not.toHaveBeenCalled();
  }
  expect(mockError).toHaveBeenCalledWith('Offline');
  await back();
  await button('Save & leave');
  expect(mockSave).toHaveBeenCalledTimes(3);
  expect(mockDispatch).toHaveBeenCalledWith(action);
});
test('discard is explicit, does not save, and preserves the originally blocked action', async () => {
  await render();
  await back();
  await back();
  expect(alert).toHaveBeenCalledTimes(1);
  await button('Discard changes');
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockDispatch).toHaveBeenCalledWith(action);
});
test.each(['account', 'token', 'deletion epoch'])(
  'late %s changes cannot save or navigate another owner from an old alert',
  async change => {
    await render();
    await back();
    if (change === 'account') mockUser = 'owner-b';
    if (change === 'token') mockToken = 'token-b';
    if (change === 'deletion epoch') mockEpoch = 1;
    await Renderer.act(async () => renderer.update(<Draft />));
    await button('Save & leave');
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  },
);
test('late save acknowledgements after account change do not navigate', async () => {
  let finish!: (saved: boolean) => void;
  mockSave.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await render();
  await back();
  await button('Save & leave');
  mockUser = 'other';
  await Renderer.act(async () => renderer.update(<Draft />));
  await Renderer.act(async () => finish(true));
  expect(mockDispatch).not.toHaveBeenCalled();
});
test('successful destructive cleanup can navigate before bumping its data epoch', async () => {
  const cleanup = jest.fn(() => {
    mockEpoch++;
  });
  await render();
  await Renderer.act(async () =>
    exposed.allowExit(
      { type: 'REPLACE', payload: { name: 'FitnessHome' } },
      cleanup,
    ),
  );
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'REPLACE',
    payload: { name: 'FitnessHome' },
  });
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('an unmounted private draft ignores a late save acknowledgement', async () => {
  let finish!: (saved: boolean) => void;
  mockSave.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await render();
  await back();
  await button('Save & leave');
  await Renderer.act(async () => renderer.unmount());
  await Renderer.act(async () => finish(true));
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(mockError).not.toHaveBeenCalled();
});

test('captured operation invalidates synchronously on data deletion before React can rerender', async () => {
  await render();
  const assertActive = exposed.captureOperation();
  expect(assertActive).not.toThrow();
  mockEpoch++;
  expect(assertActive).toThrow('Fitness space changed');
  expect(exposed.isActive()).toBe(false);
});

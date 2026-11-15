import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useAssessmentDraft } from './useAssessmentDraft';

let mockUser = { id: 'owner-a' };
let mockToken = 'token-a';
let mockEpoch = 0;
const mockRequest = jest.fn();
const mockInvalidate = jest.fn();
const mockClient = { invalidateQueries: mockInvalidate };
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/shared/api/client', () => ({ getApiToken: () => mockToken }));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClient,
}));
jest.mock('../fitnessSession', () => ({
  useFitnessDataEpoch: () => mockEpoch,
}));
jest.mock('../api/fitnessApi', () => ({
  fitnessRequest: (...args: unknown[]) => mockRequest(...args),
}));

let current: ReturnType<typeof useAssessmentDraft>;
let renderer: ReactTestRenderer.ReactTestRenderer;
function Probe() {
  current = useAssessmentDraft();
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
const profile = (assessment: unknown) => ({
  id: 'profile',
  status: 'draft',
  assessment,
});
async function render() {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
}
async function update() {
  await ReactTestRenderer.act(async () => {
    renderer.update(<Probe />);
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  mockUser = { id: 'owner-a' };
  mockToken = 'token-a';
  mockEpoch = 0;
  mockRequest.mockReset();
  mockInvalidate.mockReset();
});
afterEach(() => {
  ReactTestRenderer.act(() => renderer?.unmount());
  jest.useRealTimers();
});

test('an old account hydration response cannot populate a new account queue', async () => {
  const old = deferred<unknown>();
  const next = deferred<unknown>();
  mockRequest
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(next.promise);
  await render();
  const oldSignal = mockRequest.mock.calls[0][1].signal;
  mockUser = { id: 'owner-b' };
  mockToken = 'token-b';
  await update();
  expect(oldSignal.aborted).toBe(true);
  expect(current.ready).toBe(false);
  expect(current.draft.medicalConditions).toBeUndefined();
  await ReactTestRenderer.act(async () => {
    old.resolve({
      profile: profile({
        medicalConditions: 'Owner A confidential information',
      }),
    });
  });
  expect(current.ready).toBe(false);
  await ReactTestRenderer.act(async () => {
    next.resolve({ profile: profile({ weightKg: 80 }) });
  });
  expect(current.draft.weightKg).toBe(80);
  expect(current.draft.medicalConditions).toBeUndefined();
  expect(mockRequest.mock.calls[1][2]).toEqual({
    userId: 'owner-b',
    token: 'token-b',
  });
});
test('a queued private edit is never sent through the next account’s writer', async () => {
  const write = deferred<unknown>();
  mockRequest.mockImplementation((_path, init, session) =>
    init.method === 'PATCH'
      ? write.promise
      : Promise.resolve({
          profile: profile(
            session.userId === 'owner-a' ? { weightKg: 70 } : { weightKg: 80 },
          ),
        }),
  );
  await render();
  await ReactTestRenderer.act(async () => {
    current.saver.update('medicalConditions', 'Private A draft');
    await jest.advanceTimersByTimeAsync(650);
  });
  const oldWrite = mockRequest.mock.calls.find(
    ([, init]) => init.method === 'PATCH',
  )!;
  await ReactTestRenderer.act(async () => {
    current.saver.update('medicalConditions', 'Private A newer draft');
  });
  mockUser = { id: 'owner-b' };
  mockToken = 'token-b';
  await update();
  expect(oldWrite[1].signal.aborted).toBe(true);
  await ReactTestRenderer.act(async () => {
    write.resolve({
      profile: profile({ medicalConditions: 'Private A draft' }),
    });
    await jest.advanceTimersByTimeAsync(1000);
  });
  const writes = mockRequest.mock.calls.filter(
    ([, init]) => init.method === 'PATCH',
  );
  expect(writes).toHaveLength(1);
  expect(writes[0][2]).toEqual({ userId: 'owner-a', token: 'token-a' });
  expect(current.draft.medicalConditions).toBeUndefined();
  expect(current.draft.weightKg).toBe(80);
});
test.each(['token', 'data-epoch'])(
  'changing the %s discards pending answers before another save',
  async kind => {
    mockRequest.mockResolvedValue({ profile: null });
    await render();
    await ReactTestRenderer.act(async () => {
      current.saver.update('injuries', 'An unsaved private draft');
    });
    if (kind === 'token') mockToken = 'rotated-token';
    else mockEpoch += 1;
    await update();
    await ReactTestRenderer.act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(current.draft.injuries).toBeUndefined();
    expect(
      mockRequest.mock.calls.filter(([, init]) => init.method === 'PATCH'),
    ).toHaveLength(0);
  },
);

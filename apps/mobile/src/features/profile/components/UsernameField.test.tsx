import React from 'react';
import TestRenderer from 'react-test-renderer';
import { useUsernameAvailability } from './UsernameField';

const mockRequest = jest.fn();
jest.mock('@/shared/api/client', () => ({ apiRequest: (...args: any[]) => mockRequest(...args) }));
jest.mock('@/shared/components/PressableScale', () => ({ PressableScale: 'Pressable' }));
jest.mock('@/shared/hooks/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
let latest: ReturnType<typeof useUsernameAvailability>;
function Probe({ value }: { value: string }) { latest = useUsernameAvailability(value); return null; }
let renderer: TestRenderer.ReactTestRenderer;
function deferred() { let resolve!: (value: any) => void; let reject!: (value: any) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function advance(ms: number) { await TestRenderer.act(async () => { jest.advanceTimersByTime(ms); }); }
beforeEach(() => { jest.useFakeTimers(); mockRequest.mockReset(); });
afterEach(() => { if (renderer) TestRenderer.act(() => renderer.unmount()); jest.useRealTimers(); });

test('does not accept old availability while a newer input is waiting or checking', async () => {
  const old = deferred(), next = deferred(); mockRequest.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  TestRenderer.act(() => { renderer = TestRenderer.create(<Probe value="arun.fit" />); });
  await advance(300); expect(latest.status).toBe('checking');
  TestRenderer.act(() => renderer.update(<Probe value="arun.new" />));
  await TestRenderer.act(async () => old.resolve({ username: 'arun.fit', status: 'available', suggestions: [] }));
  expect(latest.username).toBe('arun.new'); expect(latest.status).toBe('checking');
  await advance(300);
  await TestRenderer.act(async () => next.resolve({ username: 'arun.new', status: 'taken', suggestions: ['arun.new_1'] }));
  expect(latest.status).toBe('taken'); expect(latest.suggestions).toEqual(['arun.new_1']);
});

test('invalid formats skip transport; offline and timed-out checks allow retry', async () => {
  TestRenderer.act(() => { renderer = TestRenderer.create(<Probe value="a..b" />); });
  await advance(300); expect(latest.status).toBe('invalid'); expect(mockRequest).not.toHaveBeenCalled();
  mockRequest.mockRejectedValueOnce(new Error('Offline'));
  TestRenderer.act(() => renderer.update(<Probe value="arun.fit" />)); await advance(300);
  expect(latest.status).toBe('error');
  mockRequest.mockReturnValueOnce(new Promise(() => {}));
  TestRenderer.act(() => latest.retry()); await advance(300); await advance(10_000);
  expect(latest.status).toBe('error');
  mockRequest.mockResolvedValueOnce({ username: 'arun.fit', status: 'available', suggestions: [] });
  TestRenderer.act(() => latest.retry()); await advance(300);
  expect(latest.status).toBe('available');
});

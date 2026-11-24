import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useAssistantChat } from './useAssistantChat';
import { useAssistantStore } from '../store/assistantStore';
import { useGenieSearch, type SearchReport } from '../search/searchState';

jest.mock('@/shared/services/storage', () => ({
  storage: { getString: () => undefined, set: jest.fn() },
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
const mockStream = jest.fn(),
  mockLocation = jest.fn(),
  mockNavigate = jest.fn();
let mockCurrentRoute = { name: 'Needs', params: {} };
jest.mock('@/shared/api/client', () => ({
  apiRequest: jest.fn(async () => ({})),
  apiStream: (...args: unknown[]) => mockStream(...args),
  ApiError: Error,
}));
jest.mock('@/features/business-profile/businessLocation', () => ({
  locateBusinessViewer: () => mockLocation(),
}));
jest.mock('@/shared/navigation/rootNavigation', () => ({
  rootNavigationRef: {
    isReady: () => true,
    getCurrentRoute: () => mockCurrentRoute,
  },
}));
jest.mock('@/shared/api/reelAnalytics', () => ({
  createAnalyticsEventId: () => String(Math.random()),
}));
jest.mock('../services/speechOutput', () => ({
  stopGenieSpeech: jest.fn(),
  speakGenieReply: jest.fn(async () => undefined),
}));

let chat!: ReturnType<typeof useAssistantChat>;
let tree!: Renderer.ReactTestRenderer;
const navigation = { navigate: mockNavigate };
function Probe() {
  chat = useAssistantChat(navigation);
  return null;
}
const last = () => useAssistantStore.getState().messages.at(-1);
const report = (
  rows: SearchReport['rows'],
  status: SearchReport['status'] = 'ready',
) => {
  const action = useGenieSearch.getState().command!;
  useGenieSearch.getState().publish({ ...action, status, rows });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentRoute = { name: 'Needs', params: {} };
  useGenieSearch.getState().reset();
  useAssistantStore.getState().clearMessages();
  act(() => {
    tree = Renderer.create(<Probe />);
  });
});
afterEach(() => act(() => tree.unmount()));

test('does not claim matches until Shop confirms its first report and ordinal selection uses its order', async () => {
  let task!: Promise<void>;
  act(() => {
    task = chat.sendMessage('Show resistance bands under ₹1,000');
  });
  expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'Shop' });
  expect(last()?.pending).toBe(true);
  act(() => report([], 'loading'));
  expect(last()?.pending).toBe(true);
  const open = jest.fn();
  await act(async () => {
    report([
      { id: '1', name: 'Bands A' },
      { id: '2', name: 'Bands B', open },
    ]);
    await task;
  });
  expect(last()?.content).toContain('2 matches');
  await act(async () => {
    await chat.sendMessage('Open the second one');
  });
  expect(open).toHaveBeenCalledTimes(1);
  expect(last()?.content).toBe('Opening Bands B.');
});

test('denied location carries the original category into the typed-area follow-up', async () => {
  mockLocation.mockRejectedValueOnce(new Error('denied'));
  await act(async () => {
    await chat.sendMessage('Find plumbers near me');
  });
  expect(last()?.content).toContain('Which area');
  expect(mockNavigate).not.toHaveBeenCalled();
  let task!: Promise<void>;
  act(() => {
    task = chat.sendMessage('White Town');
  });
  expect(useGenieSearch.getState().command?.filters).toMatchObject({
    categoryId: 'home.plumber',
    areaLabel: 'White Town',
  });
  await act(async () => {
    report([]);
    await task;
  });
  expect(last()?.content).toBe('No matches (White Town).');
});

test('rapid requests supersede the old action and a query error does not report an empty result', async () => {
  let old!: Promise<void>, next!: Promise<void>;
  act(() => {
    old = chat.sendMessage('Show resistance bands under ₹1,000');
  });
  const oldAction = useGenieSearch.getState().command!;
  act(() => {
    next = chat.sendMessage('Show my upcoming bookings');
  });
  act(() =>
    useGenieSearch
      .getState()
      .publish({
        ...oldAction,
        status: 'ready',
        rows: [{ id: '1', name: 'Old' }],
      }),
  );
  expect(last()?.pending).toBe(true);
  await act(async () => {
    report([], 'error');
    await Promise.all([old, next]);
  });
  expect(last()?.content).toContain('couldn’t load');
  expect(useAssistantStore.getState().quickActions).toEqual(['Retry']);
});

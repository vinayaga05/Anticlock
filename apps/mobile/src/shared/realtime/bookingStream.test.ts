const mockAppStateSubscription = { remove: jest.fn() };

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => mockAppStateSubscription),
  },
}));

jest.mock('@/shared/api/client', () => ({ getApiToken: () => 'mobile-token' }));
jest.mock('@/shared/api/config', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
  isApiEnabled: true,
}));
jest.mock('@/shared/services/auth/authService', () => ({
  readStoredSession: () => null,
}));
jest.mock('./liveClipMerge', () => ({ backoffDelay: () => 25 }));

type SocketCallback = ((event: any) => void) | null;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: SocketCallback = null;
  onmessage: SocketCallback = null;
  onerror: SocketCallback = null;
  onclose: SocketCallback = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[] | null,
    readonly options?: { headers?: Record<string, string> },
  ) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.({});
  }
}

describe('live booking transport', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('authenticates, resyncs, delivers changes, and reconnects without polling', () => {
    const { startLiveBookings, subscribeLiveBookings } = require('./bookingStream');
    const events: Array<Record<string, unknown>> = [];
    const unsubscribe = subscribeLiveBookings((event: Record<string, unknown>) => {
      events.push(event);
    });
    const stop = startLiveBookings();

    const first = MockWebSocket.instances[0]!;
    expect(first.url).toBe('wss://api.example.test/v1/bookings/stream');
    expect(first.protocols).toBeNull();
    expect(first.options?.headers).toEqual({ Authorization: 'Bearer mobile-token' });

    first.onopen?.({});
    first.onmessage?.({ data: JSON.stringify({ type: 'ready' }) });
    first.onmessage?.({
      data: JSON.stringify({
        type: 'booking.changed',
        bookingId: 'booking-1',
        status: 'confirmed',
        at: '2026-10-26T00:00:00.000Z',
      }),
    });

    expect(events).toEqual([
      { type: 'resync' },
      {
        type: 'booking.changed',
        bookingId: 'booking-1',
        status: 'confirmed',
        at: '2026-10-26T00:00:00.000Z',
      },
    ]);

    first.onclose?.({});
    expect(MockWebSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(25);
    expect(MockWebSocket.instances).toHaveLength(2);

    unsubscribe();
    stop();
  });
});

import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import type { BookingStatus } from '@anticlock/contracts';

export type BookingEvent = {
  type: 'booking.changed';
  bookingId: string;
  status: BookingStatus;
  userIds: string[];
  at: string;
};

export const BOOKING_EVENTS_CHANNEL = 'anticlock:booking-events:v1';

const local = new EventEmitter();
local.setMaxListeners(0);

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let subscribed = false;
let subscriptionActive = false;

function redisUrl() {
  return process.env.REDIS_URL?.trim() || null;
}

function deliver(event: BookingEvent) {
  local.emit('event', event);
}

function parseEvent(raw: string): BookingEvent | null {
  try {
    const value = JSON.parse(raw) as Partial<BookingEvent>;
    if (
      value.type === 'booking.changed' &&
      typeof value.bookingId === 'string' &&
      typeof value.status === 'string' &&
      Array.isArray(value.userIds)
    ) {
      return value as BookingEvent;
    }
  } catch {
    // Ignore malformed events from the shared channel.
  }
  return null;
}

function ensureSubscriber() {
  const url = redisUrl();
  if (!url || subscribed) return;
  subscribed = true;
  subscriber = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
    retryStrategy: times => Math.min(times * 500, 10_000),
  });
  subscriber.on('error', () => undefined);
  subscriber.on('ready', () => {
    subscriptionActive = false;
    subscriber
      ?.subscribe(BOOKING_EVENTS_CHANNEL)
      .then(() => {
        subscriptionActive = true;
      })
      .catch(() => {
        subscriptionActive = false;
      });
  });
  subscriber.on('close', () => {
    subscriptionActive = false;
  });
  subscriber.on('message', (channel, raw) => {
    if (channel !== BOOKING_EVENTS_CHANNEL) return;
    const event = parseEvent(raw);
    if (event) deliver(event);
  });
}

function subscriberReady() {
  return Boolean(subscriber?.status === 'ready' && subscriptionActive);
}

/** Fire-and-forget fan-out. Database writes stay authoritative if Redis is unavailable. */
export async function publishBookingEvent(event: BookingEvent): Promise<void> {
  const url = redisUrl();
  if (!url) {
    deliver(event);
    return;
  }
  ensureSubscriber();
  try {
    if (!publisher) {
      publisher = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      publisher.on('error', () => undefined);
    }
    if (publisher.status === 'wait') await publisher.connect();
    if (!subscriberReady()) throw new Error('subscriber not ready');
    await publisher.publish(BOOKING_EVENTS_CHANNEL, JSON.stringify(event));
  } catch {
    deliver(event);
  }
}

export function subscribeBookingEvents(
  listener: (event: BookingEvent) => void,
): () => void {
  ensureSubscriber();
  local.on('event', listener);
  return () => local.off('event', listener);
}

export function bookingChangedEvent(input: {
  id: string;
  status: BookingStatus;
  userIds: string[];
}): BookingEvent {
  return {
    type: 'booking.changed',
    bookingId: input.id,
    status: input.status,
    userIds: [...new Set(input.userIds)],
    at: new Date().toISOString(),
  };
}

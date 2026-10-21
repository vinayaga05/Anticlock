import { EventEmitter } from "node:events";
import Redis from "ioredis";

/**
 * Content change events fanned out to connected viewers.
 *
 * Only ids travel on the bus. Each connection re-checks visibility for its
 * own viewer before anything is sent to a device, so private, blocked,
 * removed or unpublished content is never pushed.
 *
 * Transport: Redis pub/sub when REDIS_URL is configured (every API process
 * receives every event), otherwise an in-process emitter. A Redis publish
 * failure falls back to local delivery so the single-VPS setup keeps working.
 */
export type ContentEvent =
  | {
      type: "post.published";
      postId: string;
      format: string;
      publisherProfileType: string;
      publisherProfileId: string;
      at: string;
    }
  | {
      type: "post.removed";
      postId: string;
      format: string;
      publisherProfileType: string;
      publisherProfileId: string;
      at: string;
    };

export const CONTENT_EVENTS_CHANNEL = "anticlock:content-events:v1";

const local = new EventEmitter();
local.setMaxListeners(0);

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let subscribed = false;

function redisUrl() {
  return process.env.REDIS_URL?.trim() || null;
}

function deliver(event: ContentEvent) {
  local.emit("event", event);
}

function parseEvent(raw: string): ContentEvent | null {
  try {
    const value = JSON.parse(raw) as Partial<ContentEvent>;
    if (
      (value.type === "post.published" || value.type === "post.removed") &&
      typeof value.postId === "string" &&
      typeof value.format === "string"
    ) {
      return value as ContentEvent;
    }
  } catch {
    // ignore malformed payloads
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
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
  subscriber.on("error", () => undefined);
  subscriber.on("ready", () => {
    subscriber?.subscribe(CONTENT_EVENTS_CHANNEL).catch(() => undefined);
  });
  subscriber.on("message", (channel, message) => {
    if (channel !== CONTENT_EVENTS_CHANNEL) return;
    const event = parseEvent(message);
    if (event) deliver(event);
  });
}

function subscriberReady() {
  return Boolean(subscriber && subscriber.status === "ready");
}

/** Fire-and-forget: never fails the request that changed the content. */
export async function publishContentEvent(event: ContentEvent): Promise<void> {
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
      publisher.on("error", () => undefined);
    }
    if (publisher.status === "wait") await publisher.connect();
    if (!subscriberReady()) throw new Error("subscriber not ready");
    await publisher.publish(CONTENT_EVENTS_CHANNEL, JSON.stringify(event));
  } catch {
    deliver(event);
  }
}

export function subscribeContentEvents(
  listener: (event: ContentEvent) => void,
): () => void {
  ensureSubscriber();
  local.on("event", listener);
  return () => {
    local.off("event", listener);
  };
}

export function postEvent(
  type: ContentEvent["type"],
  post: {
    id: string;
    format: string;
    publisherProfileType: string | null;
    publisherProfileId: string | null;
  },
): ContentEvent {
  return {
    type,
    postId: post.id,
    format: post.format,
    publisherProfileType: post.publisherProfileType ?? "",
    publisherProfileId: post.publisherProfileId ?? "",
    at: new Date().toISOString(),
  };
}

export async function closeContentEvents() {
  await Promise.all(
    [publisher, subscriber].map((client) => client?.quit().catch(() => undefined)),
  );
  publisher = null;
  subscriber = null;
  subscribed = false;
}

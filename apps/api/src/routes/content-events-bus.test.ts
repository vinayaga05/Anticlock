/**
 * Content event bus: in-process delivery without Redis, and Redis pub/sub
 * fanout between processes when TEST_REDIS_URL is set.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const TEST_REDIS_URL = process.env.TEST_REDIS_URL?.trim();

async function freshBus() {
  return import(`../realtime/contentEvents.js?bus=${Math.random()}`) as Promise<
    typeof import("../realtime/contentEvents.js")
  >;
}

const sample = {
  id: "00000000-0000-4000-8000-000000000001",
  format: "clip",
  publisherProfileType: "personal",
  publisherProfileId: "00000000-0000-4000-8000-000000000002",
};

describe("content event bus", () => {
  it("delivers locally when Redis is not configured", async () => {
    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const bus = await freshBus();
      const seen: string[] = [];
      const off = bus.subscribeContentEvents((event) => seen.push(`${event.type}:${event.postId}`));
      await bus.publishContentEvent(bus.postEvent("post.published", sample));
      off();
      await bus.publishContentEvent(bus.postEvent("post.removed", sample));
      assert.deepEqual(seen, [`post.published:${sample.id}`]);
    } finally {
      if (saved !== undefined) process.env.REDIS_URL = saved;
    }
  });

  it("fans out through Redis exactly once per subscriber", { skip: !TEST_REDIS_URL }, async () => {
    const saved = process.env.REDIS_URL;
    process.env.REDIS_URL = TEST_REDIS_URL;
    const bus = await freshBus();
    try {
      const seen: string[] = [];
      const off = bus.subscribeContentEvents((event) => seen.push(event.type));
      // Let the subscriber connect before publishing.
      const deadline = Date.now() + 3000;
      await bus.publishContentEvent(bus.postEvent("post.published", sample));
      while (seen.length < 1 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      await new Promise((r) => setTimeout(r, 300));
      await bus.publishContentEvent(bus.postEvent("post.removed", sample));
      while (seen.length < 2 && Date.now() < deadline + 3000) {
        await new Promise((r) => setTimeout(r, 20));
      }
      await new Promise((r) => setTimeout(r, 100));
      off();
      assert.deepEqual(seen, ["post.published", "post.removed"]);
    } finally {
      await bus.closeContentEvents();
      if (saved === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = saved;
    }
  });
});

/**
 * Live Clip events: publish -> SSE fanout, per-viewer visibility filtering,
 * removal events and the `since` catch-up read.
 *
 * DB-backed: runs only when TEST_DATABASE_URL is set (CI provides one).
 * Without REDIS_URL the event bus is in-process, which is what this suite
 * exercises; Redis only changes the transport between API processes.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "anticlock-realtime-"));
  process.env.API_PUBLIC_URL = "http://localhost:4000";
  process.env.CONTENT_STREAM_HEARTBEAT_MS = "200";
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.CONTENT_REQUIRE_REVIEW;
  delete process.env.REDIS_URL;
}

type Json = Record<string, any>;

/** Smallest byte sequence the upload validator accepts as an MP4. */
function fakeMp4(seed: string) {
  const header = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  return Buffer.concat([header, Buffer.from(`anticlock-test-video-${seed}`)]);
}

describe("live clip events (integration)", { skip: !TEST_DATABASE_URL }, () => {
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  let db: any;
  let sqlClient: any;
  let schema: any;
  let orm: any;

  const runId = randomUUID().slice(0, 8);
  const A = randomUUID();
  const B = randomUUID();
  const C = randomUUID();
  const D = randomUUID();
  const BIZ_A = randomUUID();
  const BIZ_D = randomUUID();
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = { A, B, C, D };

  async function call(who: string, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await app.request(url, {
      method,
      headers: {
        authorization: `Bearer ${tokens[who]}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: Json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  /** Real mobile upload session for one video, optionally tied to a draft. */
  async function uploadVideo(who: string, opts: { draftId?: string; durationMs?: number; byteSize?: number; complete?: boolean; put?: boolean; visibility?: string } = {}) {
    const bytes = fakeMp4(`${runId}-${randomUUID()}`);
    const session = await call(who, "POST", "/v1/content/uploads", {
      kind: "video",
      filename: "reel.mp4",
      contentType: "video/mp4",
      byteSize: opts.byteSize ?? bytes.length,
      durationMs: opts.durationMs ?? 8_000,
      width: 720,
      height: 1280,
      visibility: opts.visibility ?? "public",
      ...(opts.draftId ? { draftId: opts.draftId } : {}),
    });
    if (session.status !== 201) return { session, mediaId: null as string | null };
    const sessionId = session.json.upload.sessionId as string;
    const mediaId = session.json.upload.mediaId as string;
    if (opts.put === false) return { session, mediaId };
    const put = await app.request(`/v1/content/uploads/${sessionId}/content`, {
      method: "PUT",
      headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "video/mp4" },
      body: bytes,
    });
    assert.equal(put.status, 200, await put.text());
    if (opts.complete === false) return { session, mediaId };
    const done = await call(who, "POST", `/v1/content/uploads/${sessionId}/complete`, {});
    assert.equal(done.status, 200, JSON.stringify(done.json));
    return { session, mediaId };
  }

  async function createDraft(who: string, publisherProfileId: string, extra: Json = {}) {
    return call(who, "POST", "/v1/content/drafts", {
      contentType: "clip",
      publisherProfileId,
      visibility: "public",
      metadata: { mediaType: "video", caption: `reel ${randomUUID().slice(0, 6)}` },
      ...extra,
    });
  }

  /** The mobile composer's flow: draft → upload into it → attach → publish. */
  async function publishReel(who: string, publisherProfileId: string, opts: { visibility?: string; durationMs?: number; caption?: string } = {}) {
    const draft = await createDraft(who, publisherProfileId, {
      visibility: opts.visibility ?? "public",
      metadata: { mediaType: "video", caption: opts.caption ?? `reel ${randomUUID().slice(0, 6)}` },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.json));
    const draftId = draft.json.draft.id as string;
    const { mediaId } = await uploadVideo(who, { draftId, durationMs: opts.durationMs, visibility: opts.visibility });
    const attach = await call(who, "PATCH", `/v1/content/drafts/${draftId}`, {
      mediaIds: [mediaId],
      ...(opts.visibility ? { visibility: opts.visibility } : {}),
    });
    assert.equal(attach.status, 200, JSON.stringify(attach.json));
    const published = await call(who, "POST", `/v1/content/drafts/${draftId}/publish`, { publisherProfileId });
    return { draftId, mediaId, published, postId: published.json.post?.id as string };
  }

  const idsOf = (items: Json[]) => items.map((item) => item.id as string);
  const clipFeed = async (who: string) => {
    const res = await call(who, "GET", "/v1/content/feeds/clip?limit=50");
    assert.equal(res.status, 200, JSON.stringify(res.json));
    return res.json.items as Json[];
  };
  const personalGrid = async (who: string) =>
    idsOf((await call(who, "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`)).json.items ?? []);

  before(async () => {
    const { Hono } = await import("hono");
    const content = await import("./content.js");
    const { signToken } = await import("../lib/auth.js");
    const client = await import("../db/client.js");
    orm = await import("drizzle-orm");
    db = client.db;
    sqlClient = client.sql;
    schema = await import("../db/schema.js");

    const hono = new Hono();
    hono.route("/v1/content", content.contentMobileRoutes);
    hono.route("/v1/content", content.contentPublicRoutes);
    const blocks = await import("./blocks.js");
    hono.route("/v1/blocks", blocks.profileBlockRoutes);
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: A, phone: `+91ra${runId}`, displayName: "Asha Creator" },
      { id: B, phone: `+91rb${runId}`, displayName: "Bala Viewer" },
      { id: C, phone: `+91rc${runId}`, displayName: "Chitra Viewer" },
      { id: D, phone: `+91rd${runId}`, displayName: "Dev Other" },
    ]);
    await db.insert(schema.providers).values([
      { id: BIZ_A, mobileUserId: A, providerKind: "business", name: "Asha Yoga Studio" },
      { id: BIZ_D, mobileUserId: D, providerKind: "business", name: "Dev Clinic" },
    ]);
    await db.insert(schema.providerMemberships).values([
      { providerId: BIZ_A, mobileUserId: A, role: "owner" },
      { providerId: BIZ_D, mobileUserId: D, role: "owner" },
    ]);
    for (const [name, id] of Object.entries(ids)) {
      tokens[name] = await signToken({ sub: id, email: "", name, roles: [], kind: "mobile" });
    }
  });

  after(async () => {
    if (!db) return;
    const { inArray, like } = orm;
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [A, B, C, D]));
    await db.delete(schema.mediaAssets).where(like(schema.mediaAssets.storageKey, `%/content-${A}/%`));
    await sqlClient.end({ timeout: 5 });
  });

  type StreamEvent = { event: string; data: Json | null };

  /** Opens GET /v1/content/stream for one viewer and collects parsed events. */
  async function openStream(who: string) {
    const controller = new AbortController();
    const res = await app.request("/v1/content/stream", {
      headers: { authorization: `Bearer ${tokens[who]}` },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
    const events: StreamEvent[] = [];
    let comments = 0;
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          let split: number;
          while ((split = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            if (block.startsWith(":")) {
              comments += 1;
              continue;
            }
            let event = "message";
            const data: string[] = [];
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data.push(line.slice(5).trim());
            }
            events.push({ event, data: data.length ? JSON.parse(data.join("\n")) : null });
          }
        }
      } catch {
        // aborted
      }
    })();
    const waitFor = async (predicate: (e: StreamEvent) => boolean, ms = 4000) => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        const hit = events.find(predicate);
        if (hit) return hit;
        await new Promise((r) => setTimeout(r, 25));
      }
      return null;
    };
    await waitFor((e) => e.event === "ready");
    return {
      events,
      heartbeats: () => comments,
      waitFor,
      close: async () => {
        controller.abort();
        await reader.cancel().catch(() => undefined);
        await pump;
      },
    };
  }

  const published = (id: string) => (e: StreamEvent) => e.event === "post.published" && e.data?.id === id;
  const removed = (id: string) => (e: StreamEvent) => e.event === "post.removed" && e.data?.id === id;

  it("rejects unauthenticated stream connections", async () => {
    const res = await app.request("/v1/content/stream");
    assert.equal(res.status, 401);
  });

  it("pushes a newly published clip to other viewers and the author", async () => {
    const streamB = await openStream("B");
    const streamA = await openStream("A");
    try {
      const reel = await publishReel("A", A, { caption: "live drop" });
      assert.equal(reel.published.status, 201, JSON.stringify(reel.published.json));
      const forB = await streamB.waitFor(published(reel.postId));
      assert.ok(forB, "B receives the new clip");
      assert.equal(forB.data?.item?.id, reel.postId);
      assert.equal(forB.data?.item?.format, "clip");
      assert.ok(forB.data?.item?.playbackUrl, "item is playable");
      assert.equal(forB.data?.item?.viewerCanManage, false);
      const forA = await streamA.waitFor(published(reel.postId));
      assert.equal(forA?.data?.item?.viewerCanManage, true);

      const del = await call("A", "DELETE", `/v1/content/posts/${reel.postId}`);
      assert.equal(del.status, 200);
      assert.ok(await streamB.waitFor(removed(reel.postId)), "B learns about the removal");
      assert.ok(await streamA.waitFor(removed(reel.postId)), "author views update too");
    } finally {
      await streamA.close();
      await streamB.close();
    }
  });

  it("never pushes private or blocked content", async () => {
    const block = await call("C", "POST", "/v1/blocks", { type: "user", id: A });
    assert.ok([200, 201].includes(block.status), JSON.stringify(block.json));
    const streamB = await openStream("B");
    const streamC = await openStream("C");
    try {
      const onlyMe = await publishReel("A", A, { visibility: "only_me", caption: "secret" });
      assert.equal(onlyMe.published.status, 201, JSON.stringify(onlyMe.published.json));
      const open = await publishReel("A", A, { caption: "for everyone" });
      assert.equal(open.published.status, 201);

      assert.ok(await streamB.waitFor(published(open.postId)), "B gets the public clip");
      assert.equal(await streamB.waitFor(published(onlyMe.postId), 300), null, "only_me is not pushed");
      assert.equal(await streamC.waitFor(published(open.postId), 500), null, "blocked author is not pushed");
      assert.equal((await call("B", "GET", `/v1/content/posts/${onlyMe.postId}`)).status, 404);
      assert.equal((await call("C", "GET", `/v1/content/posts/${open.postId}`)).status, 404);
      const single = await call("B", "GET", `/v1/content/posts/${open.postId}`);
      assert.equal(single.status, 200);
      assert.equal(single.json.post.id, open.postId);
      assert.ok(single.json.post.playbackUrl);
    } finally {
      await streamB.close();
      await streamC.close();
    }
  });

  it("sends heartbeats on an idle stream", async () => {
    const stream = await openStream("D");
    try {
      await new Promise((r) => setTimeout(r, 500));
      assert.ok(stream.heartbeats() >= 1);
    } finally {
      await stream.close();
    }
  });

  it("catches up with clips published since a timestamp", async () => {
    const since = new Date(Date.now() - 5).toISOString();
    await new Promise((r) => setTimeout(r, 20));
    const fresh = await publishReel("A", A, { caption: "while offline" });
    assert.equal(fresh.published.status, 201);
    const res = await call("B", "GET", `/v1/content/feeds/clip?limit=20&since=${encodeURIComponent(since)}`);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const ids = idsOf(res.json.items);
    assert.ok(ids.includes(fresh.postId), "new clip is in the catch-up page");
    for (const item of res.json.items as Json[]) {
      assert.ok(Date.parse(item.publishedAt) > Date.parse(since));
    }
    assert.equal(res.json.nextCursor, null);
    const bad = await call("B", "GET", "/v1/content/feeds/clip?since=nope");
    assert.equal(bad.status, 400);
  });
});

/**
 * Owner delete for Clips and the `viewerCanManage` feed flag, through the
 * real HTTP routes and the local upload-session flow.
 *
 * DB-backed: runs only when TEST_DATABASE_URL is set (CI provides one).
 *
 * Cast: A owns a personal profile + an approved business (BIZ_A); B and C
 * are viewers; D owns another business and must never manage A's Clips.
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
  process.env.MEDIA_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "anticlock-owner-delete-"));
  process.env.API_PUBLIC_URL = "http://localhost:4000";
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.CONTENT_REQUIRE_REVIEW;
}

type Json = Record<string, any>;

/** Smallest byte sequence the upload validator accepts as an MP4. */
function fakeMp4(seed: string) {
  const header = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  return Buffer.concat([header, Buffer.from(`anticlock-test-video-${seed}`)]);
}

describe("clip owner delete (integration)", { skip: !TEST_DATABASE_URL }, () => {
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
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: A, phone: `+91oa${runId}`, displayName: "Asha Creator" },
      { id: B, phone: `+91ob${runId}`, displayName: "Bala Viewer" },
      { id: C, phone: `+91oc${runId}`, displayName: "Chitra Viewer" },
      { id: D, phone: `+91od${runId}`, displayName: "Dev Other" },
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

  let personalReel = "";
  let businessReel = "";

  it("flags viewerCanManage only for the owner / managing business member", async () => {
    const personal = await publishReel("A", A, { caption: "morning flow" });
    assert.equal(personal.published.status, 201, JSON.stringify(personal.published.json));
    personalReel = personal.postId;
    const business = await publishReel("A", BIZ_A, { caption: "studio tour" });
    assert.equal(business.published.status, 201, JSON.stringify(business.published.json));
    businessReel = business.postId;

    const mine = await clipFeed("A");
    for (const id of [personalReel, businessReel]) {
      const item = mine.find((i) => i.id === id);
      assert.ok(item, `A sees ${id}`);
      assert.equal(item.viewerCanManage, true);
    }
    for (const viewer of ["B", "D"]) {
      const feed = await clipFeed(viewer);
      for (const id of [personalReel, businessReel]) {
        const item = feed.find((i) => i.id === id);
        assert.ok(item, `${viewer} sees ${id}`);
        assert.equal(item.viewerCanManage, false);
      }
    }
  });

  it("non-owners cannot delete (404, nothing disclosed); bad ids are 404", async () => {
    assert.equal((await call("B", "DELETE", `/v1/content/posts/${personalReel}`)).status, 404);
    assert.equal((await call("D", "DELETE", `/v1/content/posts/${businessReel}`)).status, 404);
    assert.equal((await call("B", "DELETE", `/v1/content/posts/${randomUUID()}`)).status, 404);
    assert.equal((await call("B", "DELETE", "/v1/content/posts/not-a-uuid")).status, 404);
    assert.ok((await personalGrid("C")).includes(personalReel), "still visible after failed deletes");
  });

  it("owner delete removes the Clip from feeds, profile and engagement; idempotent", async () => {
    const del = await call("A", "DELETE", `/v1/content/posts/${personalReel}`);
    assert.equal(del.status, 200, JSON.stringify(del.json));
    assert.deepEqual(del.json.post, { id: personalReel, contentStatus: "removed" });
    const again = await call("A", "DELETE", `/v1/content/posts/${personalReel}`);
    assert.equal(again.status, 200);

    for (const viewer of ["A", "B", "C"]) {
      assert.ok(!(await personalGrid(viewer)).includes(personalReel), `${viewer} grid`);
    }
    assert.ok(!idsOf(await clipFeed("C")).includes(personalReel), "gone from the Clips feed");
    assert.equal((await call("B", "PUT", `/v1/content/posts/${personalReel}/like`, { liked: true })).status, 404);
  });

  it("a member managing the business can delete the business Clip", async () => {
    const del = await call("A", "DELETE", `/v1/content/posts/${businessReel}`);
    assert.equal(del.status, 200, JSON.stringify(del.json));
    const biz = await call("C", "GET", `/v1/content/profiles/business/${BIZ_A}/posts?format=clip`);
    assert.ok(!idsOf(biz.json.items ?? []).includes(businessReel));
  });
});

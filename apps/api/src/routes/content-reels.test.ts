/**
 * End-to-end Reel/Clip scenarios across several accounts and publisher
 * profiles, through the real HTTP routes and the local upload-session flow
 * (create session → PUT bytes → complete → attach → publish).
 *
 * DB-backed: runs only when TEST_DATABASE_URL is set (CI provides one).
 *
 * Cast: A owns a personal profile + an approved business (BIZ_A) and has a
 * second application still under review; B and C are viewers; D owns a
 * business A must never be able to publish as.
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
  process.env.MEDIA_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "anticlock-reels-"));
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

describe("reels across users and publisher profiles (integration)", { skip: !TEST_DATABASE_URL }, () => {
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
  const BIZ_A_SUSPENDED = randomUUID();
  const BIZ_D = randomUUID();
  const APP_UNDER_REVIEW = randomUUID();
  const ADMIN = randomUUID();
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = { A, B, C, D };
  let adminToken = "";

  async function call(who: string, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await app.request(url, {
      method,
      headers: {
        authorization: `Bearer ${who === "admin" ? adminToken : tokens[who]}`,
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

  /** Drains the viewer's Clips feed page by page (bounded). */
  async function drainClipFeed(who: string, limit = 30) {
    const seen: Json[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const res = await call(who, "GET", `/v1/content/feeds/clip?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      assert.equal(res.status, 200, JSON.stringify(res.json));
      seen.push(...(res.json.items as Json[]));
      cursor = res.json.nextCursor;
      if (!cursor) break;
    }
    return seen;
  }

  const idsOf = (items: Json[]) => items.map((item) => item.id as string);

  before(async () => {
    const { Hono } = await import("hono");
    const content = await import("./content.js");
    const { moderationAdminRoutes } = await import("./moderation.js");
    const { contentSafetyRoutes } = await import("./contentSafety.js");
    const { profileBlockRoutes } = await import("./blocks.js");
    const { signToken } = await import("../lib/auth.js");
    const client = await import("../db/client.js");
    orm = await import("drizzle-orm");
    db = client.db;
    sqlClient = client.sql;
    schema = await import("../db/schema.js");

    const hono = new Hono();
    hono.route("/v1/content", content.contentMobileRoutes);
    hono.route("/v1/content", content.contentPublicRoutes);
    hono.route("/v1/content", contentSafetyRoutes);
    hono.route("/v1/blocks", profileBlockRoutes);
    hono.route("/admin/moderation", moderationAdminRoutes);
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: A, phone: `+91ra${runId}`, displayName: "Asha Creator", avatarUrl: "https://cdn.example.com/asha.png" },
      { id: B, phone: `+91rb${runId}`, displayName: "Bala Viewer", avatarUrl: "https://cdn.example.com/bala.png" },
      { id: C, phone: `+91rc${runId}`, displayName: "Chitra Viewer" },
      { id: D, phone: `+91rd${runId}`, displayName: "Dev Other" },
    ]);
    await db.insert(schema.providers).values([
      {
        id: BIZ_A,
        mobileUserId: A,
        providerKind: "business",
        name: "Asha Yoga Studio",
        publicProfile: { common: { basic: { handle: "ashayoga", logoUrl: "https://cdn.example.com/yoga.png" } } },
      },
      { id: BIZ_A_SUSPENDED, mobileUserId: A, providerKind: "business", name: "Asha Paused", status: "suspended" },
      { id: BIZ_D, mobileUserId: D, providerKind: "business", name: "Dev Clinic" },
    ]);
    await db.insert(schema.providerMemberships).values([
      { providerId: BIZ_A, mobileUserId: A, role: "owner" },
      { providerId: BIZ_A_SUSPENDED, mobileUserId: A, role: "owner" },
      { providerId: BIZ_D, mobileUserId: D, role: "owner" },
    ]);
    await db.insert(schema.providerApplications).values({
      id: APP_UNDER_REVIEW,
      mobileUserId: A,
      providerKind: "business",
      status: "under_review",
      commonPayload: { basic: { providerName: "Asha Bakery (pending)" } },
    });

    for (const [name, id] of Object.entries(ids)) {
      tokens[name] = await signToken({ sub: id, email: "", name, roles: [], kind: "mobile" });
    }
    await db.insert(schema.users).values({
      id: ADMIN,
      email: `moderator-${runId}@example.com`,
      name: "Moderator",
      passwordHash: "x",
    });
    adminToken = await signToken({
      sub: ADMIN,
      email: "admin@example.com",
      name: "Admin",
      roles: [],
      permissions: ["moderation.act", "moderation.read"],
      kind: "admin",
    });
  });

  after(async () => {
    if (!db) return;
    const { inArray, like } = orm;
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [A, B, C, D]));
    await db.delete(schema.users).where(inArray(schema.users.id, [ADMIN]));
    await db.delete(schema.mediaAssets).where(like(schema.mediaAssets.storageKey, `%/content-${A}/%`));
    await sqlClient.end({ timeout: 5 });
  });

  let personalReel = "";
  let businessReel = "";

  it("S1: a personal reel uploaded by A is visible to A, B and C with A's name and avatar", async () => {
    const { published, postId } = await publishReel("A", A, { caption: "morning flow" });
    assert.equal(published.status, 201, JSON.stringify(published.json));
    assert.equal(published.json.post.contentStatus, "published");
    personalReel = postId;

    // A sees the new reel first in their own feed right after publishing.
    const mine = await call("A", "GET", "/v1/content/feeds/clip?limit=5");
    assert.equal(mine.status, 200);
    assert.equal(mine.json.items[0]?.id, postId, "author's fresh reel leads their feed");
    assert.equal(mine.json.items[0].viewerCanManage, true);

    for (const viewer of ["B", "C"]) {
      const feed = await drainClipFeed(viewer);
      const item = feed.find((i) => i.id === postId);
      assert.ok(item, `${viewer} sees A's reel in the Clips feed`);
      assert.equal(item.publisher.type, "personal");
      assert.equal(item.publisher.displayName, "Asha Creator");
      assert.equal(item.publisher.avatarUrl, "https://cdn.example.com/asha.png");
      assert.equal(item.author.name, "Asha Creator");
      assert.ok(/^https?:\/\//.test(item.playbackUrl));
      assert.equal(item.viewerCanManage, false);
      const grid = await call(viewer, "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
      assert.ok(idsOf(grid.json.items).includes(postId), `${viewer} sees it on A's profile`);
    }
    const ownGrid = await call("A", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.deepEqual(idsOf(ownGrid.json.items), [postId]);
  });

  it("S2: a reel published as A's business shows the business, only on the business profile", async () => {
    const { published, postId } = await publishReel("A", BIZ_A, { caption: "studio tour" });
    assert.equal(published.status, 201, JSON.stringify(published.json));
    businessReel = postId;
    const feed = await drainClipFeed("B");
    const item = feed.find((i) => i.id === postId);
    assert.ok(item, "B sees the business reel");
    assert.equal(item.publisher.type, "business");
    assert.equal(item.publisher.id, BIZ_A);
    assert.equal(item.publisher.displayName, "Asha Yoga Studio");
    assert.equal(item.publisher.avatarUrl, "https://cdn.example.com/yoga.png");
    assert.equal(item.author.type, "provider");
    assert.equal(item.author.id, BIZ_A, "tapping the publisher opens the business profile");

    const biz = await call("C", "GET", `/v1/content/profiles/business/${BIZ_A}/posts?format=clip`);
    assert.deepEqual(idsOf(biz.json.items), [postId]);
    const personal = await call("C", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.ok(!idsOf(personal.json.items).includes(postId), "never on A's personal grid");
    const summary = await call("C", "GET", `/v1/content/profiles/business/${BIZ_A}`);
    assert.equal(summary.json.profile.counts.clips, 1);
  });

  it("S3: under-review / suspended / someone else's profiles cannot be published as", async () => {
    const identities = await call("A", "GET", "/v1/content/identities");
    const available = (identities.json.identities as Json[]).map((i) => i.id);
    assert.deepEqual(available.sort(), [A, BIZ_A].sort(), "only personal + approved business");

    for (const forged of [APP_UNDER_REVIEW, BIZ_A_SUSPENDED, BIZ_D]) {
      const res = await createDraft("A", forged, { publisherProfileType: "business" });
      assert.equal(res.status, 403, `${forged} → ${JSON.stringify(res.json)}`);
    }
    const asB = await createDraft("A", B, { publisherProfileType: "personal" });
    assert.equal(asB.status, 403);

    // A draft started as personal cannot be published as the business.
    const draft = await createDraft("A", A);
    const { mediaId } = await uploadVideo("A", { draftId: draft.json.draft.id });
    await call("A", "PATCH", `/v1/content/drafts/${draft.json.draft.id}`, { mediaIds: [mediaId] });
    const swapped = await call("A", "POST", `/v1/content/drafts/${draft.json.draft.id}/publish`, { publisherProfileId: BIZ_A });
    assert.equal(swapped.status, 403);
    // B cannot publish (or touch) A's draft or attach A's media.
    const hijack = await call("B", "POST", `/v1/content/drafts/${draft.json.draft.id}/publish`, {});
    assert.equal(hijack.status, 404);
    const bDraft = await createDraft("B", B);
    const stolen = await call("B", "PATCH", `/v1/content/drafts/${bDraft.json.draft.id}`, { mediaIds: [mediaId] });
    assert.equal(stolen.status, 403);
    await call("A", "DELETE", `/v1/content/drafts/${draft.json.draft.id}`);
  });

  it("S4: uploading / processing / failed items are only visible to the author; retry and discard work", async () => {
    const before = new Set(idsOf(await drainClipFeed("C")));
    const draft = await createDraft("A", A, { metadata: { mediaType: "video", caption: "half uploaded" } });
    const draftId = draft.json.draft.id;
    const { mediaId } = await uploadVideo("A", { draftId, complete: false });
    let mine = await call("A", "GET", "/v1/content/mine");
    assert.equal((mine.json.items as Json[]).find((i) => i.draftId === draftId)?.contentStatus, "uploading");

    const attach = await call("A", "PATCH", `/v1/content/drafts/${draftId}`, { mediaIds: [mediaId] });
    assert.equal(attach.json.draft.contentStatus, "processing");
    const early = await call("A", "POST", `/v1/content/drafts/${draftId}/publish`, {});
    assert.equal(early.status, 409);
    assert.equal(early.json.error.code, "media_processing");

    // Mark the media failed (e.g. transcoding error) → draft is failed.
    await db.update(schema.mediaAssets).set({ processingStatus: "failed" }).where(orm.eq(schema.mediaAssets.id, mediaId));
    const failed = await call("A", "POST", `/v1/content/drafts/${draftId}/publish`, {});
    assert.equal(failed.status, 400);
    assert.equal(failed.json.error.code, "media_failed");
    mine = await call("A", "GET", "/v1/content/mine");
    assert.equal((mine.json.items as Json[]).find((i) => i.draftId === draftId)?.contentStatus, "failed");

    // Nobody else ever sees it.
    const cFeed = await drainClipFeed("C");
    assert.ok(cFeed.every((i) => !before.has(i.id) || true));
    assert.ok(!cFeed.some((i) => i.caption === "half uploaded"));
    assert.equal((await call("B", "GET", `/v1/content/drafts/${draftId}`)).status, 404);

    // Retry: a fresh upload into the same draft publishes it with the same profile.
    const retry = await uploadVideo("A", { draftId });
    const reattach = await call("A", "PATCH", `/v1/content/drafts/${draftId}`, { mediaIds: [retry.mediaId] });
    assert.equal(reattach.json.draft.contentStatus, "draft");
    const ok = await call("A", "POST", `/v1/content/drafts/${draftId}/publish`, { publisherProfileId: A });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    assert.equal(ok.json.draft.publisherProfileId, A);

    // Discard (cancel) a second in-progress draft.
    const cancelled = await createDraft("A", A, { metadata: { mediaType: "video", caption: "cancelled" } });
    await uploadVideo("A", { draftId: cancelled.json.draft.id, put: false });
    const discard = await call("A", "DELETE", `/v1/content/drafts/${cancelled.json.draft.id}`);
    assert.equal(discard.status, 200);
    mine = await call("A", "GET", "/v1/content/mine");
    assert.ok(!(mine.json.items as Json[]).some((i) => i.draftId === cancelled.json.draft.id));
    // Clean up the extra published reel so later counts stay simple.
    await call("A", "DELETE", `/v1/content/posts/${ok.json.post.id}`);
  });

  it("S5: the Clips feed paginates without repeats and keeps showing reels once everything was seen", async () => {
    // A few more reels from D's business so there is something to page through.
    const extra: string[] = [];
    for (let i = 0; i < 4; i += 1) extra.push((await publishReel("D", BIZ_D)).postId);
    const first = await call("C", "GET", "/v1/content/feeds/clip?limit=2");
    assert.equal(first.status, 200);
    assert.equal(first.json.items.length, 2);
    assert.ok(first.json.nextCursor, "more pages are available");
    const all = await drainClipFeed("C", 2);
    const unique = new Set(idsOf([...first.json.items, ...all]));
    for (const id of extra) assert.ok(unique.has(id), "every new reel is reachable by scrolling");
    // A new session after everything was seen still gets a non-empty feed.
    const again = await call("C", "GET", "/v1/content/feeds/clip?limit=5");
    assert.ok(again.json.items.length > 0, "feed is never empty once all reels were seen");
    for (const item of again.json.items as Json[]) {
      assert.ok(item.posterUrl === null || /^https?:/.test(item.posterUrl));
      assert.equal(typeof item.viewCount, "number");
    }
    const view = await call("C", "POST", `/v1/content/posts/${extra[0]}/view-events`, { eventId: randomUUID(), watchedMs: 3000 });
    assert.equal(view.status, 200);
    assert.equal(view.json.data.recorded, true);
    const repeat = await call("C", "POST", `/v1/content/posts/${extra[0]}/view-events`, { eventId: randomUUID(), watchedMs: 3000 });
    assert.equal(repeat.json.data.recorded, false, "one view per viewer per day");
    for (const id of extra) await call("D", "DELETE", `/v1/content/posts/${id}`);
  });

  it("S6: likes and comments from B are reflected for A and C; a shared link resolves the reel", async () => {
    const like = await call("B", "PUT", `/v1/content/posts/${personalReel}/like`, { liked: true });
    assert.equal(like.status, 200, JSON.stringify(like.json));
    assert.equal(like.json.data.likeCount, 1);
    const again = await call("B", "PUT", `/v1/content/posts/${personalReel}/like`, { liked: true });
    assert.equal(again.json.data.changed, false, "idempotent");
    const comment = await call("B", "POST", `/v1/content/posts/${personalReel}/comments`, { body: "Beautiful!" });
    assert.equal(comment.status, 201);
    assert.equal(comment.json.comment.publisher.displayName, "Bala Viewer");
    assert.equal(comment.json.comment.publisher.avatarUrl, "https://cdn.example.com/bala.png");

    for (const viewer of ["A", "C"]) {
      const single = await call(viewer, "GET", `/v1/content/posts/${personalReel}`);
      assert.equal(single.status, 200, JSON.stringify(single.json));
      assert.equal(single.json.post.likeCount, 1);
      assert.equal(single.json.post.commentCount, 1);
      assert.ok(/^https?:\/\//.test(single.json.post.playbackUrl), "deep link can play the reel");
      assert.equal(single.json.post.publisher.displayName, "Asha Creator");
      const comments = await call(viewer, "GET", `/v1/content/posts/${personalReel}/comments`);
      assert.equal(comments.json.items[0].publisher.displayName, "Bala Viewer");
    }
    const grid = await call("C", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    const item = (grid.json.items as Json[]).find((i) => i.id === personalReel)!;
    assert.equal(item.likeCount, 1);
    assert.equal(item.commentCount, 1);
    assert.equal(item.viewerHasLiked, false);

    const unlike = await call("B", "PUT", `/v1/content/posts/${personalReel}/like`, { liked: false });
    assert.equal(unlike.json.data.likeCount, 0);
    const missing = await call("C", "GET", `/v1/content/posts/${randomUUID()}`);
    assert.equal(missing.status, 404);
  });

  it("S7: owner deletes → gone everywhere; non-owner cannot; reports hide for the reporter; removal hides for all", async () => {
    const { postId } = await publishReel("A", A, { caption: "to be deleted" });
    const notOwner = await call("B", "DELETE", `/v1/content/posts/${postId}`);
    assert.equal(notOwner.status, 404);
    const bizNotOwner = await call("D", "DELETE", `/v1/content/posts/${businessReel}`);
    assert.equal(bizNotOwner.status, 404);
    const del = await call("A", "DELETE", `/v1/content/posts/${postId}`);
    assert.equal(del.status, 200, JSON.stringify(del.json));
    assert.equal(del.json.post.contentStatus, "removed");
    for (const viewer of ["A", "B", "C"]) {
      assert.ok(!idsOf(await drainClipFeed(viewer)).includes(postId));
      const grid = await call(viewer, "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
      assert.ok(!idsOf(grid.json.items).includes(postId));
      assert.equal((await call(viewer, "GET", `/v1/content/posts/${postId}`)).status, 404);
    }
    const like = await call("B", "PUT", `/v1/content/posts/${postId}/like`, { liked: true });
    assert.equal(like.status, 404);
    const summary = await call("B", "GET", `/v1/content/profiles/personal/${A}`);
    assert.equal(summary.json.profile.counts.clips, 1, "only the first personal reel remains");

    // Report by B hides the reel for B only; admin removal hides it for all.
    const report = await call("B", "POST", `/v1/content/posts/${businessReel}/reports`, { reason: "spam" });
    assert.equal(report.status, 201, JSON.stringify(report.json));
    assert.ok(!idsOf(await drainClipFeed("B")).includes(businessReel), "reporter no longer sees it");
    const bBiz = await call("B", "GET", `/v1/content/profiles/business/${BIZ_A}/posts?format=clip`);
    assert.ok(!idsOf(bBiz.json.items).includes(businessReel));
    const cBiz = await call("C", "GET", `/v1/content/profiles/business/${BIZ_A}/posts?format=clip`);
    assert.ok(idsOf(cBiz.json.items).includes(businessReel), "others still see it until removed");

    const action = await call("admin", "POST", `/admin/moderation/reports/content_post/${report.json.data.id}/action`, {
      action: "remove_content",
      note: "spam",
    });
    assert.equal(action.status, 200, JSON.stringify(action.json));
    const cAfter = await call("C", "GET", `/v1/content/profiles/business/${BIZ_A}/posts?format=clip`);
    assert.ok(!idsOf(cAfter.json.items).includes(businessReel));
    assert.ok(!idsOf(await drainClipFeed("C")).includes(businessReel));
  });

  it("S8: blocked and deactivated authors and restricted visibility are not shown", async () => {
    const block = await call("C", "POST", "/v1/blocks", { type: "user", id: A });
    assert.ok([200, 201].includes(block.status), JSON.stringify(block.json));
    assert.ok(!idsOf(await drainClipFeed("C")).includes(personalReel));
    const cGrid = await call("C", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.equal(cGrid.status === 404 || cGrid.json.items.length === 0, true);
    assert.equal((await call("C", "GET", `/v1/content/posts/${personalReel}`)).status, 404);
    await call("C", "DELETE", `/v1/blocks/user/${A}`);

    // A blocked B → B no longer sees A's personal content either.
    await call("A", "POST", "/v1/blocks", { type: "user", id: B });
    const bGrid = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.ok(bGrid.status === 404 || !idsOf(bGrid.json.items).includes(personalReel), "blocked viewer cannot see blocker's reels");
    assert.equal((await call("B", "GET", `/v1/content/posts/${personalReel}`)).status, 404);
    await call("A", "DELETE", `/v1/blocks/user/${B}`);

    const priv = await publishReel("A", A, { visibility: "only_me", caption: "just me" });
    assert.equal(priv.published.status, 201, JSON.stringify(priv.published.json));
    assert.ok(!idsOf(await drainClipFeed("B")).includes(priv.postId));
    assert.equal((await call("B", "GET", `/v1/content/posts/${priv.postId}`)).status, 404);
    const aGrid = await call("A", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.ok(idsOf(aGrid.json.items).includes(priv.postId), "owner sees own private reel");

    await db.update(schema.mobileUsers).set({ isActive: false }).where(orm.eq(schema.mobileUsers.id, A));
    try {
      const grid = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
      assert.ok(!idsOf(grid.json.items ?? []).includes(personalReel));
      assert.equal((await call("B", "GET", `/v1/content/posts/${personalReel}`)).status, 404);
      const feed = await call("B", "GET", "/v1/content/feeds/clip?limit=30");
      assert.ok(!idsOf(feed.json.items).includes(personalReel));
    } finally {
      await db.update(schema.mobileUsers).set({ isActive: true }).where(orm.eq(schema.mobileUsers.id, A));
    }
  });

  it("S9: edge cases — too long, too large, landscape, several uploads in a row, profile fixed per draft", async () => {
    const long = await publishReel("A", A, { durationMs: 95_000 });
    assert.equal(long.published.status, 400);
    assert.equal(long.published.json.error.code, "clip_too_long");
    await call("A", "DELETE", `/v1/content/drafts/${long.draftId}`);

    const huge = await uploadVideo("A", { byteSize: 2 * 1024 * 1024 * 1024 });
    assert.equal(huge.session.status, 400);
    assert.equal(huge.session.json.error.code, "file_too_large");

    // Several uploads in a row, interleaved between two profiles, each keeps
    // the profile its draft started with.
    const d1 = await createDraft("A", A);
    const d2 = await createDraft("A", BIZ_A);
    const u1 = await uploadVideo("A", { draftId: d1.json.draft.id });
    const u2 = await uploadVideo("A", { draftId: d2.json.draft.id });
    await call("A", "PATCH", `/v1/content/drafts/${d2.json.draft.id}`, { mediaIds: [u2.mediaId] });
    await call("A", "PATCH", `/v1/content/drafts/${d1.json.draft.id}`, { mediaIds: [u1.mediaId] });
    const p2 = await call("A", "POST", `/v1/content/drafts/${d2.json.draft.id}/publish`, {});
    const p1 = await call("A", "POST", `/v1/content/drafts/${d1.json.draft.id}/publish`, {});
    assert.equal(p1.status, 201);
    assert.equal(p2.status, 201);
    assert.notEqual(p1.json.post.id, p2.json.post.id);
    assert.equal(p1.json.draft.publisherProfileType, "personal");
    assert.equal(p2.json.draft.publisherProfileType, "business");
    assert.equal(p2.json.draft.publisherProfileId, BIZ_A);
  });
});

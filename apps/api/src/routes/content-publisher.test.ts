/**
 * DB-backed integration tests for publishing AS a profile (personal or
 * business) and for who can see the result. They run against a real
 * Postgres when TEST_DATABASE_URL is set (CI provides one; locally:
 * `docker run -p 55432:5432 -e POSTGRES_USER=anticlock -e POSTGRES_PASSWORD=anticlock postgres:16-alpine`,
 * `DATABASE_URL=… pnpm db:migrate`, then
 * `TEST_DATABASE_URL=… pnpm test`). Without it the suite is skipped.
 *
 * Two main accounts are used throughout: A owns a personal profile and
 * two businesses, B is an unrelated viewer; C owns another business.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
if (TEST_DATABASE_URL) {
  // Must be set before the db client module is first imported.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "anticlock-media-"));
  process.env.API_PUBLIC_URL = "http://localhost:4000";
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.CONTENT_REQUIRE_REVIEW;
}

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

type Json = Record<string, any>;

describe("content publisher profiles (integration)", { skip: !TEST_DATABASE_URL }, () => {
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  let db: any;
  let sqlClient: any;
  let schema: any;
  let signToken: any;

  const runId = randomUUID().slice(0, 8);
  const A = randomUUID();
  const B = randomUUID();
  const C = randomUUID();
  // providers.mobile_user_id is unique (one provider application per
  // account), so A's second business is held via a provider_memberships
  // owner row — exactly how a user gets access to more than one business.
  const D = randomUUID();
  const BIZ1 = randomUUID();
  const BIZ2 = randomUUID();
  const BIZ_C = randomUUID();
  const treeId = `test-tree-${runId}`;
  const categoryId = `test-cat-${runId}`;
  const tokens: Record<string, string> = {};
  let adminToken = "";

  async function call(
    who: string,
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; json: Json }> {
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
    return { status: res.status, json: text ? JSON.parse(text) : {} };
  }

  /** A ready, owner-tagged asset (as if uploaded via an R2 upload session). */
  async function readyAsset(
    owner: string,
    kind: "video" | "image",
    access: "public" | "private" = "public"
  ) {
    const id = randomUUID();
    const bucket = access === "public" ? "public-media" : "private-documents";
    await db.insert(schema.mediaAssets).values({
      id,
      kind,
      storageProvider: "local",
      storageKey: `${access}/content-${owner}/${id}/final.${kind === "video" ? "mp4" : "png"}`,
      bucket,
      mimeType: kind === "video" ? "video/mp4" : "image/png",
      byteSize: 1000,
      durationMs: kind === "video" ? 10_000 : null,
      accessLevel: access,
      processingStatus: "ready",
      moderationStatus: "approved",
      checksumSha256: `${runId}-${id}`,
    });
    return id;
  }

  /** Full draft flow: create draft → attach media → publish. */
  async function publish(
    who: string,
    input: {
      contentType: "clip" | "reel" | "flash" | "story";
      publisherProfileId: string;
      publisherProfileType?: "personal" | "business";
      visibility?: string;
      mediaType?: "text" | "image" | "video" | "hybrid";
      caption?: string;
      media?: ("video" | "image")[];
    }
  ) {
    const created = await call(who, "POST", "/v1/content/drafts", {
      contentType: input.contentType,
      publisherProfileId: input.publisherProfileId,
      ...(input.publisherProfileType
        ? { publisherProfileType: input.publisherProfileType }
        : {}),
      visibility: input.visibility ?? "public",
      metadata: {
        mediaType: input.mediaType ?? (input.media?.length ? input.media[0] : "text"),
        caption: input.caption ?? `post ${randomUUID().slice(0, 6)}`,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const draftId = created.json.draft.id as string;
    assert.equal(created.json.draft.contentStatus, "draft");
    if (input.media?.length) {
      const access = (input.visibility ?? "public") === "public" ? "public" : "private";
      const mediaIds: string[] = [];
      for (const kind of input.media) mediaIds.push(await readyAsset(who === "A" ? A : who === "B" ? B : C, kind, access));
      const patched = await call(who, "PATCH", `/v1/content/drafts/${draftId}`, { mediaIds });
      assert.equal(patched.status, 200, JSON.stringify(patched.json));
      // Media READY does not make content public; it waits for publish.
      assert.equal(patched.json.draft.contentStatus, "draft");
    }
    const published = await call(who, "POST", `/v1/content/drafts/${draftId}/publish`, {});
    assert.equal(published.status, 201, JSON.stringify(published.json));
    return { draftId, postId: published.json.post.id as string, response: published.json };
  }

  function ids(items: Json[]) {
    return items.map((item) => item.id);
  }

  before(async () => {
    const { Hono } = await import("hono");
    const content = await import("./content.js");
    const { moderationAdminRoutes } = await import("./moderation.js");
    const { contentSafetyRoutes } = await import("./contentSafety.js");
    ({ signToken } = await import("../lib/auth.js"));
    const client = await import("../db/client.js");
    db = client.db;
    sqlClient = client.sql;
    schema = await import("../db/schema.js");

    const hono = new Hono();
    hono.route("/v1/content", content.contentMobileRoutes);
    hono.route("/v1/content", content.contentPublicRoutes);
    hono.route("/v1/content", contentSafetyRoutes);
    hono.route("/admin/moderation", moderationAdminRoutes);
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: A, phone: `+91a${runId}`, displayName: "Asha Personal", avatarUrl: "https://cdn.example.com/asha.png" },
      { id: B, phone: `+91b${runId}`, displayName: "Bala Viewer" },
      { id: C, phone: `+91c${runId}`, displayName: "Chitra Other" },
      { id: D, phone: `+91d${runId}`, displayName: "Bakery Holding" },
    ]);
    await db.insert(schema.serviceTrees).values({ id: treeId, slug: treeId, name: "Test tree" }).onConflictDoNothing();
    await db
      .insert(schema.serviceCategories)
      .values({ id: categoryId, treeId, name: "Yoga Studio" })
      .onConflictDoNothing();
    await db.insert(schema.providers).values([
      {
        id: BIZ1,
        mobileUserId: A,
        providerKind: "business",
        name: "Asha Yoga Studio",
        publicProfile: { common: { basic: { handle: "ashayoga", logoUrl: "https://cdn.example.com/yoga.png" } } },
      },
      { id: BIZ2, mobileUserId: D, providerKind: "business", name: "Asha Bakery" },
      { id: BIZ_C, mobileUserId: C, providerKind: "business", name: "Chitra Clinic" },
    ]);
    await db.insert(schema.providerMemberships).values([
      { providerId: BIZ1, mobileUserId: A, role: "owner" },
      { providerId: BIZ2, mobileUserId: A, role: "owner" },
      { providerId: BIZ_C, mobileUserId: C, role: "owner" },
    ]);
    await db.insert(schema.providerServiceOfferings).values({ providerId: BIZ1, categoryId });

    for (const [name, id] of Object.entries({ A, B, C })) {
      tokens[name] = await signToken({ sub: id, email: "", name, roles: [], kind: "mobile" });
    }
    adminToken = await signToken({
      sub: randomUUID(),
      email: "admin@example.com",
      name: "Admin",
      roles: [],
      permissions: ["moderation.act"],
      kind: "admin",
    });
  });

  after(async () => {
    if (!db) return;
    const { like, inArray } = await import("drizzle-orm");
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [A, B, C, D]));
    await db.delete(schema.mediaAssets).where(like(schema.mediaAssets.checksumSha256, `${runId}-%`));
    await db.delete(schema.serviceCategories).where(inArray(schema.serviceCategories.id, [categoryId]));
    await db.delete(schema.serviceTrees).where(inArray(schema.serviceTrees.id, [treeId]));
    await sqlClient.end({ timeout: 5 });
  });

  it("lists the personal profile and every owned business as publishing identities", async () => {
    const res = await call("A", "GET", "/v1/content/identities");
    assert.equal(res.status, 200);
    const identities = res.json.identities as Json[];
    assert.deepEqual([identities[0]!.profileType, identities[0]!.id], ["personal", A]);
    assert.deepEqual(
      identities
        .slice(1)
        .map((i) => `${i.profileType}:${i.id}`)
        .sort(),
      [`business:${BIZ1}`, `business:${BIZ2}`].sort()
    );
    const yoga = identities.find((i) => i.id === BIZ1)!;
    assert.equal(yoga.publisher.businessCategory, "Yoga Studio");
    assert.equal(yoga.type, "provider", "legacy field kept for old clients");
  });

  it("1) a public Reel published as Personal shows in B's Clips feed and on A's personal profile", async () => {
    const { postId, response } = await publish("A", {
      contentType: "reel",
      publisherProfileId: A,
      media: ["video"],
      mediaType: "video",
    });
    assert.equal(response.post.contentStatus, "published");
    assert.equal(response.draft.publisherProfileType, "personal");

    const feed = await call("B", "GET", "/v1/content/feeds/clip");
    assert.equal(feed.status, 200, JSON.stringify(feed.json));
    const item = (feed.json.items as Json[]).find((i) => i.id === postId);
    assert.ok(item, "B sees A's reel in the Clips feed");
    assert.equal(item.publisher.type, "personal");
    assert.equal(item.publisher.displayName, "Asha Personal");
    assert.equal(item.author.type, "user");

    const profile = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.equal(profile.status, 200);
    assert.ok(ids(profile.json.items).includes(postId));
    const summary = await call("B", "GET", `/v1/content/profiles/personal/${A}`);
    assert.equal(summary.json.profile.counts.clips, 1);
    assert.equal(summary.json.profile.viewerCanManage, false);
  });

  it("2) a Reel published as Business 1 shows under Business 1, not under A's personal profile", async () => {
    const { postId } = await publish("A", {
      contentType: "clip",
      publisherProfileId: BIZ1,
      publisherProfileType: "business",
      media: ["video"],
      mediaType: "video",
    });
    const feed = await call("B", "GET", "/v1/content/feeds/clip");
    const item = (feed.json.items as Json[]).find((i) => i.id === postId);
    assert.ok(item, "B sees the business reel in Clips");
    assert.equal(item.publisher.type, "business");
    assert.equal(item.publisher.id, BIZ1);
    assert.equal(item.publisher.displayName, "Asha Yoga Studio");
    assert.equal(item.publisherProfileType, "business");

    const biz = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=clip`);
    assert.deepEqual(ids(biz.json.items), [postId]);
    const personal = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.ok(!ids(personal.json.items).includes(postId), "never mixed into personal");
    const summary = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}`);
    assert.equal(summary.json.profile.counts.clips, 1);
  });

  it("3) Business 1 and Business 2 content never mix", async () => {
    const { postId: biz2Post } = await publish("A", {
      contentType: "flash",
      publisherProfileId: BIZ2,
      caption: "fresh bread",
    });
    const biz1 = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=flash`);
    const biz2 = await call("B", "GET", `/v1/content/profiles/business/${BIZ2}/posts?format=flash`);
    assert.ok(!ids(biz1.json.items).includes(biz2Post));
    assert.deepEqual(ids(biz2.json.items), [biz2Post]);
    assert.equal(biz2.json.items[0].publisher.displayName, "Asha Bakery");
  });

  it("4) Flash text, image and video posts from a business are visible to B in Flash and on the business profile", async () => {
    const text = await publish("A", { contentType: "flash", publisherProfileId: BIZ1, caption: "Open today" });
    const image = await publish("A", { contentType: "flash", publisherProfileId: BIZ1, media: ["image"], mediaType: "image" });
    const video = await publish("A", { contentType: "flash", publisherProfileId: BIZ1, media: ["video"], mediaType: "video" });
    const mixed = await publish("A", {
      contentType: "flash",
      publisherProfileId: BIZ1,
      media: ["image", "video"],
      mediaType: "hybrid",
    });
    const feed = await call("B", "GET", "/v1/content/posts?format=flash");
    assert.equal(feed.status, 200);
    const feedIds = ids(feed.json.items);
    for (const p of [text, image, video, mixed]) assert.ok(feedIds.includes(p.postId));
    // `data` stays as a compatibility alias for the shipped mobile client.
    assert.deepEqual(ids(feed.json.data), feedIds);
    const mixedItem = (feed.json.items as Json[]).find((i) => i.id === mixed.postId)!;
    assert.deepEqual(mixedItem.media.map((m: Json) => m.kind), ["image", "video"]);
    assert.ok(mixedItem.media.every((m: Json) => /^https?:\/\//.test(m.url)));

    const profile = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=flash`);
    for (const p of [text, image, video, mixed]) assert.ok(ids(profile.json.items).includes(p.postId));
    const personal = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=flash`);
    assert.equal(personal.json.items.length, 0);

    // Engagement works on business-published Flash posts.
    const like = await call("B", "PUT", `/v1/content/posts/${image.postId}/like`, { liked: true });
    assert.equal(like.status, 200, JSON.stringify(like.json));
    assert.equal(like.json.data.likeCount, 1);
    const report = await call("B", "POST", `/v1/content/posts/${text.postId}/reports`, { reason: "spam" });
    assert.equal(report.status, 201, JSON.stringify(report.json));
  });

  it("5) a Story from a business shows the business in B's tray until it expires", async () => {
    const { postId } = await publish("A", {
      contentType: "story",
      publisherProfileId: BIZ1,
      media: ["image"],
      mediaType: "image",
    });
    const tray = await call("B", "GET", "/v1/content/posts?format=story");
    const story = (tray.json.items as Json[]).find((i) => i.id === postId);
    assert.ok(story, "B sees the story");
    assert.equal(story.publisher.displayName, "Asha Yoga Studio");
    assert.equal(story.publisher.avatarUrl, "https://cdn.example.com/yoga.png");
    assert.ok(new Date(story.expiresAt).getTime() > Date.now() + 23 * 60 * 60 * 1000);

    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.contentPosts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.contentPosts.id, postId));
    const after = await call("B", "GET", "/v1/content/posts?format=story");
    assert.ok(!ids(after.json.items).includes(postId), "expired story is gone");
  });

  it("6) draft/uploading/processing/pending_review/rejected content is only visible in A's management view", async () => {
    // draft
    const draft = await call("A", "POST", "/v1/content/drafts", {
      contentType: "flash",
      publisherProfileId: BIZ1,
      metadata: { caption: "still a draft" },
    });
    // uploading: a real upload session tied to the draft (local storage)
    const uploading = await call("A", "POST", "/v1/content/drafts", {
      contentType: "flash",
      publisherProfileId: A,
      metadata: { mediaType: "image", caption: "uploading" },
    });
    const session = await call(
      "A",
      "POST",
      "/v1/content/uploads",
      { kind: "image", filename: "a.png", contentType: "image/png", byteSize: PNG_BYTES.length, draftId: uploading.json.draft.id },
      { "x-anticlock-context-type": "user", "x-anticlock-context-id": A }
    );
    assert.equal(session.status, 201, JSON.stringify(session.json));
    // processing: media attached but not ready yet
    const processing = await call("A", "POST", "/v1/content/drafts", {
      contentType: "flash",
      publisherProfileId: A,
      metadata: { mediaType: "image", caption: "processing" },
    });
    const patched = await call("A", "PATCH", `/v1/content/drafts/${processing.json.draft.id}`, {
      mediaIds: [session.json.upload.mediaId],
    });
    assert.equal(patched.json.draft.contentStatus, "processing");
    const early = await call("A", "POST", `/v1/content/drafts/${processing.json.draft.id}/publish`, {});
    assert.equal(early.status, 409);
    assert.equal(early.json.error.code, "media_processing");

    // pending_review + rejected (review mode)
    process.env.CONTENT_REQUIRE_REVIEW = "true";
    let pending: Awaited<ReturnType<typeof publish>>;
    let rejected: Awaited<ReturnType<typeof publish>>;
    try {
      pending = await publish("A", { contentType: "flash", publisherProfileId: BIZ1, caption: "awaiting review" });
      rejected = await publish("A", { contentType: "flash", publisherProfileId: BIZ1, caption: "will be rejected" });
    } finally {
      delete process.env.CONTENT_REQUIRE_REVIEW;
    }
    assert.equal(pending.response.post.contentStatus, "pending_review");
    const reject = await call("admin", "POST", `/admin/moderation/content/${rejected.postId}/review`, { decision: "reject" });
    assert.equal(reject.status, 200, JSON.stringify(reject.json));

    const mine = await call("A", "GET", "/v1/content/mine");
    assert.equal(mine.status, 200);
    const statusById = new Map((mine.json.items as Json[]).map((i) => [i.draftId, i.contentStatus]));
    assert.equal(statusById.get(draft.json.draft.id), "draft");
    assert.equal(statusById.get(uploading.json.draft.id), "uploading");
    assert.equal(statusById.get(processing.json.draft.id), "processing");
    assert.equal(statusById.get(pending.draftId), "pending_review");
    assert.equal(statusById.get(rejected.draftId), "rejected");
    // Management view spans profiles and carries the owner id.
    assert.ok((mine.json.items as Json[]).every((i) => i.ownerUserId === A));

    const hiddenPosts = [pending.postId, rejected.postId];
    const feed = await call("B", "GET", "/v1/content/posts?format=flash&limit=50");
    const profile = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=flash&limit=50`);
    for (const id of hiddenPosts) {
      assert.ok(!ids(feed.json.items).includes(id));
      assert.ok(!ids(profile.json.items).includes(id));
    }
    const peek = await call("B", "GET", `/v1/content/drafts/${draft.json.draft.id}`);
    assert.equal(peek.status, 404, "B cannot read A's draft");
    const hijack = await call("B", "PATCH", `/v1/content/drafts/${draft.json.draft.id}`, { metadata: { caption: "x" } });
    assert.equal(hijack.status, 404);
    const bMine = await call("B", "GET", "/v1/content/mine");
    assert.equal(bMine.json.items.length, 0);

    // Approval publishes without changing the publisher.
    const approve = await call("admin", "POST", `/admin/moderation/content/${pending.postId}/review`, { decision: "approve" });
    assert.equal(approve.status, 200);
    const afterApproval = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=flash&limit=50`);
    const approved = (afterApproval.json.items as Json[]).find((i) => i.id === pending.postId);
    assert.ok(approved);
    assert.equal(approved.publisher.id, BIZ1);
  });

  it("7) followers / friends / private audiences are enforced", async () => {
    const followers = await publish("A", { contentType: "flash", publisherProfileId: A, visibility: "followers", caption: "followers only" });
    const friends = await publish("A", { contentType: "flash", publisherProfileId: A, visibility: "friends", caption: "friends only" });
    const priv = await publish("A", { contentType: "flash", publisherProfileId: A, visibility: "private", caption: "only me" });
    const restricted = [followers.postId, friends.postId, priv.postId];

    // There is no follower/friend graph in the API yet, so B is not eligible.
    const bFeed = await call("B", "GET", "/v1/content/posts?format=flash&limit=50");
    const bProfile = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=flash&limit=50`);
    for (const id of restricted) {
      assert.ok(!ids(bFeed.json.items).includes(id));
      assert.ok(!ids(bProfile.json.items).includes(id));
    }
    const bLike = await call("B", "PUT", `/v1/content/posts/${priv.postId}/like`, { liked: true });
    assert.equal(bLike.status, 404);

    const aProfile = await call("A", "GET", `/v1/content/profiles/personal/${A}/posts?format=flash&limit=50`);
    for (const id of restricted) assert.ok(ids(aProfile.json.items).includes(id), "owner sees own restricted posts");
    const privItem = (aProfile.json.items as Json[]).find((i) => i.id === priv.postId)!;
    assert.equal(privItem.visibility, "only_me");
    assert.equal(privItem.viewerCanManage, true);
  });

  it("8) publishing with another user's profile is rejected with 403", async () => {
    const otherBusiness = await call("A", "POST", "/v1/content/drafts", {
      contentType: "clip",
      publisherProfileId: BIZ_C,
      publisherProfileType: "business",
    });
    assert.equal(otherBusiness.status, 403);
    const otherPersonal = await call("A", "POST", "/v1/content/drafts", {
      contentType: "flash",
      publisherProfileId: B,
      publisherProfileType: "personal",
      metadata: { caption: "impersonation" },
    });
    assert.equal(otherPersonal.status, 403);
    const legacyHeader = await call(
      "A",
      "POST",
      "/v1/content/containers",
      { format: "flash", mediaType: "text", caption: "legacy", visibility: "public" },
      { "x-anticlock-context-type": "provider", "x-anticlock-context-id": BIZ_C }
    );
    assert.equal(legacyHeader.status, 403);
    const comment = await call("B", "GET", "/v1/content/posts?format=flash");
    const target = (comment.json.items as Json[])[0]!;
    const commentAsOther = await call("B", "POST", `/v1/content/posts/${target.id}/comments`, {
      body: "hi",
      publisherProfileId: BIZ1,
    });
    assert.equal(commentAsOther.status, 403);
  });

  it("10) publisher name/avatar/handle/businessCategory are server-derived everywhere, including comments", async () => {
    const { postId } = await publish("A", { contentType: "flash", publisherProfileId: BIZ1, caption: "Comment on me" });
    const asBusiness = await call("A", "POST", `/v1/content/posts/${postId}/comments`, {
      body: "Thanks for visiting!",
      publisherProfileId: BIZ1,
    });
    assert.equal(asBusiness.status, 201, JSON.stringify(asBusiness.json));
    const asB = await call("B", "POST", `/v1/content/posts/${postId}/comments`, { body: "Love it" });
    assert.equal(asB.status, 201);

    const expectedBusiness = {
      id: BIZ1,
      type: "business",
      displayName: "Asha Yoga Studio",
      handle: "ashayoga",
      avatarUrl: "https://cdn.example.com/yoga.png",
      verified: true,
      businessCategory: "Yoga Studio",
    };
    const comments = await call("B", "GET", `/v1/content/posts/${postId}/comments`);
    assert.deepEqual(comments.json.items[0].publisher, expectedBusiness);
    assert.equal(comments.json.items[1].publisher.displayName, "Bala Viewer");
    assert.equal(comments.json.items[1].publisher.type, "personal");

    const feed = await call("B", "GET", "/v1/content/posts?format=flash&limit=50");
    const item = (feed.json.items as Json[]).find((i) => i.id === postId)!;
    assert.deepEqual(item.publisher, expectedBusiness);
    assert.equal(item.commentCount, 2);
    assert.equal(item.ownerUserId, undefined, "owner is never exposed to viewers");
    const summary = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}`);
    assert.deepEqual(summary.json.profile.publisher, expectedBusiness);

    const personal = await call("B", "GET", `/v1/content/profiles/personal/${A}`);
    assert.deepEqual(personal.json.profile.publisher, {
      id: A,
      type: "personal",
      displayName: "Asha Personal",
      handle: null,
      avatarUrl: "https://cdn.example.com/asha.png",
      verified: false,
      businessCategory: null,
    });
  });

  it("supports the real upload-session flow into a draft and keeps the selected business through publish", async () => {
    const draft = await call("A", "POST", "/v1/content/drafts", {
      contentType: "story",
      publisherProfileId: BIZ2,
      metadata: { mediaType: "image" },
    });
    const draftId = draft.json.draft.id;
    const session = await call(
      "A",
      "POST",
      "/v1/content/uploads",
      { kind: "image", filename: "s.png", contentType: "image/png", byteSize: PNG_BYTES.length, draftId },
      { "x-anticlock-context-type": "provider", "x-anticlock-context-id": BIZ2 }
    );
    assert.equal(session.status, 201, JSON.stringify(session.json));
    const put = await app.request(`/v1/content/uploads/${session.json.upload.sessionId}/content`, {
      method: "PUT",
      headers: { authorization: `Bearer ${tokens.A}`, "content-type": "image/png" },
      body: PNG_BYTES,
    });
    assert.equal(put.status, 200, await put.text());
    const complete = await call("A", "POST", `/v1/content/uploads/${session.json.upload.sessionId}/complete`, {});
    assert.equal(complete.status, 200, JSON.stringify(complete.json));
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.mediaAssets)
      .set({ checksumSha256: `${runId}-${session.json.upload.mediaId}` })
      .where(eq(schema.mediaAssets.id, session.json.upload.mediaId));
    const attach = await call("A", "PATCH", `/v1/content/drafts/${draftId}`, { mediaIds: [session.json.upload.mediaId] });
    assert.equal(attach.json.draft.contentStatus, "draft");
    // A mismatching publisher at publish time is refused.
    const wrong = await call("A", "POST", `/v1/content/drafts/${draftId}/publish`, { publisherProfileId: BIZ1 });
    assert.equal(wrong.status, 403);
    const ok = await call("A", "POST", `/v1/content/drafts/${draftId}/publish`, { publisherProfileId: BIZ2 });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    assert.equal(ok.json.draft.publisherProfileId, BIZ2);
    // Publishing twice is idempotent.
    const again = await call("A", "POST", `/v1/content/drafts/${draftId}/publish`, {});
    assert.equal(again.json.post.id, ok.json.post.id);

    const tray = await call("B", "GET", "/v1/content/posts?format=story");
    const story = (tray.json.items as Json[]).find((i) => i.id === ok.json.post.id);
    assert.ok(story);
    assert.equal(story.publisher.displayName, "Asha Bakery");
  });

  it("keeps the legacy container API working with a business identity", async () => {
    const headers = { "x-anticlock-context-type": "provider", "x-anticlock-context-id": BIZ1 };
    const created = await call(
      "A",
      "POST",
      "/v1/content/containers",
      { format: "flash", mediaType: "text", caption: "legacy business post", visibility: "public" },
      headers
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assert.equal(created.json.container.publisher.id, BIZ1);
    const mismatch = await call("A", "POST", `/v1/content/containers/${created.json.container.id}/publish`, undefined, {
      "x-anticlock-context-type": "user",
      "x-anticlock-context-id": A,
    });
    assert.equal(mismatch.status, 403);
    const published = await call("A", "POST", `/v1/content/containers/${created.json.container.id}/publish`, undefined, headers);
    assert.equal(published.status, 201, JSON.stringify(published.json));
    const profile = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=flash&limit=50`);
    assert.ok(ids(profile.json.items).includes(published.json.post.id));
  });
});

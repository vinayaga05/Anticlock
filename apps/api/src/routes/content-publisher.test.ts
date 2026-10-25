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
  // BIZ2 is created by another account (D) and A is granted an owner
  // provider_memberships row — how a user gets access to a business they
  // did not create. (Owners can also create several businesses directly.)
  const D = randomUUID();
  const BIZ1 = randomUUID();
  const BIZ2 = randomUUID();
  const BIZ_C = randomUUID();
  const treeId = `test-tree-${runId}`;
  const categoryId = `test-cat-${runId}`;
  const otherCategoryId = `test-other-cat-${runId}`;
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
    const { profileFollowRoutes } = await import("./profile-follows.js");
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
    hono.route("/v1/profile-follows", profileFollowRoutes);
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
      .values([
        { id: categoryId, treeId, name: "Yoga Studio" },
        { id: otherCategoryId, treeId, name: "Bakery" },
      ])
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
    await db.insert(schema.providerServiceOfferings).values([
      { providerId: BIZ1, categoryId },
      { providerId: BIZ_C, categoryId },
      { providerId: BIZ2, categoryId: otherCategoryId },
    ]);

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
    await db
      .delete(schema.serviceCategories)
      .where(inArray(schema.serviceCategories.id, [categoryId, otherCategoryId]));
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
    assert.equal(item.providerId, BIZ1);
    assert.equal(item.businessId, BIZ1);
    assert.equal(item.serviceCategoryId, categoryId);

    const biz = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}/posts?format=clip`);
    assert.deepEqual(ids(biz.json.items), [postId]);
    const personal = await call("B", "GET", `/v1/content/profiles/personal/${A}/posts?format=clip`);
    assert.ok(!ids(personal.json.items).includes(postId), "never mixed into personal");
    const summary = await call("B", "GET", `/v1/content/profiles/business/${BIZ1}`);
    assert.equal(summary.json.profile.counts.clips, 1);
    assert.equal(summary.json.profile.serviceCategoryId, categoryId);
    assert.deepEqual(summary.json.profile.serviceCategoryIds, [categoryId]);
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

  it("returns every eligible Clip newest-first through cursor pagination without watched suppression", async () => {
    const created = [
      await publish("A", { contentType: "clip", publisherProfileId: A, publisherProfileType: "personal", media: ["video"], mediaType: "video" }),
      await publish("A", { contentType: "clip", publisherProfileId: BIZ1, publisherProfileType: "business", media: ["video"], mediaType: "video" }),
      await publish("B", { contentType: "clip", publisherProfileId: B, publisherProfileType: "personal", media: ["video"], mediaType: "video" }),
      await publish("C", { contentType: "clip", publisherProfileId: BIZ_C, publisherProfileType: "business", media: ["video"], mediaType: "video" }),
    ];
    const { eq } = await import("drizzle-orm");
    for (let index = 0; index < created.length; index += 1) {
      await db.update(schema.contentPosts).set({
        publishedAt: new Date(Date.UTC(2030, 0, index + 1)),
      }).where(eq(schema.contentPosts.id, created[index]!.postId));
    }
    const expected = created.map(item => item.postId).reverse();
    const page1 = await call("C", "GET", "/v1/content/feeds/clip?limit=2");
    assert.equal(page1.status, 200, JSON.stringify(page1.json));
    assert.deepEqual(ids(page1.json.items), expected.slice(0, 2));
    assert.ok(page1.json.nextCursor);
    const page2 = await call(
      "C",
      "GET",
      `/v1/content/feeds/clip?limit=2&cursor=${encodeURIComponent(page1.json.nextCursor)}`,
    );
    assert.deepEqual(ids(page2.json.items), expected.slice(2));
    const allIds = [...ids(page1.json.items), ...ids(page2.json.items)];
    let cursor = page2.json.nextCursor as string | null;
    while (cursor) {
      const page = await call("C", "GET", `/v1/content/feeds/clip?limit=2&cursor=${encodeURIComponent(cursor)}`);
      allIds.push(...ids(page.json.items));
      cursor = page.json.nextCursor;
    }
    assert.equal(new Set(allIds).size, allIds.length, "pages never duplicate Reel IDs");
    for (const id of expected) assert.ok(allIds.includes(id));
    const refreshed = await call("C", "GET", "/v1/content/feeds/clip?limit=2");
    assert.deepEqual(ids(refreshed.json.items), expected.slice(0, 2), "watched Clips remain in canonical feed");
    const newlyPublished = await publish("A", {
      contentType: "clip",
      publisherProfileId: BIZ1,
      publisherProfileType: "business",
      media: ["video"],
      mediaType: "video",
    });
    await db.update(schema.contentPosts).set({
      publishedAt: new Date(Date.UTC(2031, 0, 1)),
    }).where(eq(schema.contentPosts.id, newlyPublished.postId));
    const refreshedWithNew = await call("C", "GET", "/v1/content/feeds/clip?limit=2");
    assert.equal(refreshedWithNew.json.items[0].id, newlyPublished.postId);
    assert.equal(refreshedWithNew.json.items[0].publisherProfileId, BIZ1);
    assert.equal(refreshedWithNew.json.items[0].publisher.displayName, "Asha Yoga Studio");
    assert.deepEqual(
      page1.json.items.map((item: Json) => [item.publisherProfileType, item.publisher.displayName]),
      [["business", "Chitra Clinic"], ["personal", "Bala Viewer"]],
    );
  });

  it("returns provider Clips first, then only approved peers in the same service category", async () => {
    const selectedOlder = await publish("A", {
      contentType: "clip",
      publisherProfileId: BIZ1,
      publisherProfileType: "business",
      media: ["video"],
      mediaType: "video",
    });
    const selectedNewer = await publish("A", {
      contentType: "clip",
      publisherProfileId: BIZ1,
      publisherProfileType: "business",
      media: ["video"],
      mediaType: "video",
    });
    const categoryPeer = await publish("C", {
      contentType: "clip",
      publisherProfileId: BIZ_C,
      publisherProfileType: "business",
      media: ["video"],
      mediaType: "video",
    });
    const unrelated = await publish("A", {
      contentType: "clip",
      publisherProfileId: BIZ2,
      publisherProfileType: "business",
      media: ["video"],
      mediaType: "video",
    });
    const privateClip = await publish("A", {
      contentType: "clip",
      publisherProfileId: BIZ1,
      publisherProfileType: "business",
      visibility: "private",
      media: ["video"],
      mediaType: "video",
    });

    process.env.CONTENT_REQUIRE_REVIEW = "true";
    let pending: Awaited<ReturnType<typeof publish>>;
    try {
      pending = await publish("A", {
        contentType: "clip",
        publisherProfileId: BIZ1,
        publisherProfileType: "business",
        media: ["video"],
        mediaType: "video",
      });
    } finally {
      delete process.env.CONTENT_REQUIRE_REVIEW;
    }
    assert.equal(pending.response.post.contentStatus, "pending_review");

    const all: Json[] = [];
    let cursor: string | null = null;
    do {
      const qs = new URLSearchParams({
        providerId: BIZ1,
        serviceCategoryId: categoryId,
        limit: "2",
      });
      if (cursor) qs.set("cursor", cursor);
      const page = await call(
        "B",
        "GET",
        `/v1/content/feeds/provider-clips?${qs.toString()}`,
      );
      assert.equal(page.status, 200, JSON.stringify(page.json));
      all.push(...page.json.items);
      cursor = page.json.nextCursor;
    } while (cursor);

    assert.equal(new Set(ids(all)).size, all.length, "cursor pages never duplicate Clips");
    assert.ok(ids(all).includes(selectedOlder.postId));
    assert.ok(ids(all).includes(selectedNewer.postId));
    assert.ok(ids(all).includes(categoryPeer.postId));
    assert.ok(!ids(all).includes(unrelated.postId), "another category never leaks in");
    assert.ok(!ids(all).includes(privateClip.postId), "private Clips stay out");
    assert.ok(!ids(all).includes(pending.postId), "unapproved Clips stay out");
    assert.ok(all.every((item) => item.serviceCategoryId === categoryId));
    const firstPeer = all.findIndex((item) => item.providerId !== BIZ1);
    assert.ok(firstPeer > 0, "same-category peers follow the selected provider");
    assert.ok(
      all.slice(0, firstPeer).every((item) => item.providerId === BIZ1) &&
        all.slice(firstPeer).every((item) => item.providerId === BIZ_C),
      "provider-priority ordering survives cursor boundaries",
    );

    const approved = await call(
      "admin",
      "POST",
      `/admin/moderation/content/${pending.postId}/review`,
      { decision: "approve" },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.json));
    const afterApproval = await call(
      "B",
      "GET",
      `/v1/content/feeds/provider-clips?providerId=${BIZ1}&serviceCategoryId=${categoryId}&limit=50`,
    );
    assert.ok(ids(afterApproval.json.items).includes(pending.postId));
  });

  it("enforces profile-scoped follows, private requests, rejection, blocking, and business privacy", async () => {
    const follow = (who: string, followerId: string, followerType: "personal" | "business", followedId: string, followedType: "personal" | "business") =>
      call(who, "POST", "/v1/profile-follows", {
        followerProfileId: followerId,
        followerProfileType: followerType,
        followedProfileId: followedId,
        followedProfileType: followedType,
      });

    // Public personal relationship persists across independent profile reads.
    const publicPersonalFollow = await follow("A", A, "personal", B, "personal");
    assert.equal(publicPersonalFollow.status, 201, JSON.stringify(publicPersonalFollow.json));
    assert.equal(publicPersonalFollow.json.data.relationship.followStatus, "following");
    const followedAuthorPost = await publish("B", {
      contentType: "flash",
      publisherProfileId: B,
      visibility: "public",
      mediaType: "text",
      caption: "follow-state post",
    });
    const followingFeed = await call("A", "GET", "/v1/content/posts?format=flash&limit=50");
    const followedFeedItem = (followingFeed.json.items as Json[]).find(item => item.id === followedAuthorPost.postId);
    assert.ok(followedFeedItem);
    assert.equal(followedFeedItem.relationship.followStatus, "following");
    const persisted = await call("A", "GET", `/v1/content/profiles/personal/${B}`);
    assert.equal(persisted.json.profile.followStatus, "following");
    assert.equal(persisted.json.profile.socialCounts.followers, 1);
    const publicPersonalUnfollow = await call("A", "DELETE", "/v1/profile-follows", {
      followerProfileId: A, followerProfileType: "personal", followedProfileId: B, followedProfileType: "personal",
    });
    assert.equal(publicPersonalUnfollow.status, 200);
    assert.equal(publicPersonalUnfollow.json.data.relationship.followStatus, "not_following");
    const afterUnfollow = await call("A", "GET", `/v1/content/profiles/personal/${B}`);
    assert.equal(afterUnfollow.json.profile.followStatus, "not_following");
    assert.equal(afterUnfollow.json.profile.socialCounts.followers, 0);
    const unfollowedFeed = await call("A", "GET", "/v1/content/posts?format=flash&limit=50");
    const unfollowedFeedItem = (unfollowedFeed.json.items as Json[]).find(item => item.id === followedAuthorPost.postId);
    assert.ok(unfollowedFeedItem);
    assert.equal(unfollowedFeedItem.relationship.followStatus, "not_following");

    // One account's personal and business profiles follow independently.
    const personalBusinessFollow = await follow("A", A, "personal", BIZ_C, "business");
    assert.equal(personalBusinessFollow.status, 201, JSON.stringify(personalBusinessFollow.json));
    const ownerPersonalStillSeparate = await call("A", "GET", `/v1/content/profiles/personal/${C}`);
    assert.equal(ownerPersonalStillSeparate.json.profile.followStatus, "not_following");
    const businessBusinessFollow = await follow("A", BIZ1, "business", BIZ_C, "business");
    assert.equal(businessBusinessFollow.status, 201, JSON.stringify(businessBusinessFollow.json));
    await call("A", "DELETE", "/v1/profile-follows", {
      followerProfileId: A, followerProfileType: "personal", followedProfileId: BIZ_C, followedProfileType: "business",
    });
    const personalIdentityState = await call("A", "GET", `/v1/content/profiles/business/${BIZ_C}`);
    assert.equal(personalIdentityState.json.profile.followStatus, "not_following");
    const businessIdentityState = await call(
      "A",
      "GET",
      `/v1/content/profiles/business/${BIZ_C}?viewerProfileType=business&viewerProfileId=${BIZ1}`,
    );
    assert.equal(businessIdentityState.json.profile.followStatus, "following");
    await follow("A", A, "personal", BIZ_C, "business");

    // Private personal profile: request has no followers-only access until accepted.
    const privacy = await call("A", "PATCH", `/v1/profile-follows/privacy/personal/${A}`, {
      isPrivate: true,
      allowFollowRequests: true,
      showFollowerLists: true,
    });
    assert.equal(privacy.status, 200, JSON.stringify(privacy.json));
    const pending = await follow("C", C, "personal", A, "personal");
    assert.equal(pending.status, 202, JSON.stringify(pending.json));
    assert.equal(pending.json.data.relationship.followStatus, "requested");
    const { and: sqlAnd, eq: sqlEq } = await import("drizzle-orm");
    const requestNotifications = await db.select().from(schema.notifications).where(sqlAnd(
      sqlEq(schema.notifications.mobileUserId, A),
      sqlEq(schema.notifications.type, "follow_request"),
    ));
    assert.ok(requestNotifications.some((item: Json) =>
      item.data?.followerProfile?.id === C && item.data?.followedProfile?.id === A
    ));
    const unauthorizedCreate = await follow("B", C, "personal", BIZ_C, "business");
    assert.equal(unauthorizedCreate.status, 403);
    const unauthorizedCancel = await call("B", "DELETE", "/v1/profile-follows", {
      followerProfileId: C, followerProfileType: "personal", followedProfileId: A, followedProfileType: "personal",
    });
    assert.equal(unauthorizedCancel.status, 403);
    const unauthorizedAccept = await call("B", "POST", `/v1/profile-follows/requests/personal/${A}/accept`, {
      id: C,
      type: "personal",
    });
    assert.equal(unauthorizedAccept.status, 403);
    const followersOnly = await publish("A", {
      contentType: "flash",
      publisherProfileId: A,
      visibility: "followers",
      mediaType: "text",
      caption: "private follower post",
    });
    const before = await call("C", "GET", `/v1/content/profiles/personal/${A}/posts?format=flash`);
    assert.ok(!ids(before.json.items).includes(followersOnly.postId));
    const accepted = await call("A", "POST", `/v1/profile-follows/requests/personal/${A}/accept`, {
      id: C,
      type: "personal",
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
    const acceptedNotifications = await db.select().from(schema.notifications).where(sqlAnd(
      sqlEq(schema.notifications.mobileUserId, C),
      sqlEq(schema.notifications.type, "follow_accepted"),
    ));
    assert.ok(acceptedNotifications.some((item: Json) =>
      item.data?.followerProfile?.id === C && item.data?.followedProfile?.id === A
    ));
    const afterAccept = await call("C", "GET", `/v1/content/profiles/personal/${A}/posts?format=flash`);
    assert.ok(ids(afterAccept.json.items).includes(followersOnly.postId));

    // Rejection deletes the pending row and exposes no permanent rejected state.
    await call("C", "DELETE", "/v1/profile-follows", {
      followerProfileId: C, followerProfileType: "personal", followedProfileId: A, followedProfileType: "personal",
    });
    await follow("C", C, "personal", A, "personal");
    const rejected = await call("A", "POST", `/v1/profile-follows/requests/personal/${A}/reject`, {
      id: C,
      type: "personal",
    });
    assert.equal(rejected.status, 200);
    const relationship = await call("C", "GET", `/v1/profile-follows/relationship/personal/${A}`);
    assert.equal(relationship.json.data.followStatus, "not_following");

    // Block removes both-direction requests/follows and prevents future requests.
    const blocked = await call("A", "POST", "/v1/profile-follows/blocks", {
      followerProfileId: A, followerProfileType: "personal", followedProfileId: C, followedProfileType: "personal",
    });
    assert.equal(blocked.status, 201);
    const blockedAttempt = await follow("C", C, "personal", A, "personal");
    assert.equal(blockedAttempt.status, 403);

    // A private business keeps the two profile-specific existing followers.
    await call("C", "PATCH", `/v1/profile-follows/privacy/business/${BIZ_C}`, {
      isPrivate: true,
      allowFollowRequests: true,
      showFollowerLists: true,
    });
    const businessPost = await publish("C", {
      contentType: "clip",
      publisherProfileId: BIZ_C,
      publisherProfileType: "business",
      visibility: "followers",
      media: ["video"],
      mediaType: "video",
    });
    const asBusinessFollower = await call(
      "A",
      "GET",
      `/v1/content/profiles/business/${BIZ_C}/posts?format=clip&viewerProfileType=business&viewerProfileId=${BIZ1}`,
    );
    assert.ok(ids(asBusinessFollower.json.items).includes(businessPost.postId));
    const outsider = await call("B", "GET", `/v1/content/profiles/business/${BIZ_C}/posts?format=clip`);
    assert.ok(!ids(outsider.json.items).includes(businessPost.postId));
    const outsiderFeed = await call("B", "GET", "/v1/content/feeds/clip?limit=50");
    assert.ok(!ids(outsiderFeed.json.items).includes(businessPost.postId));
    const acceptedBusinessFeed = await call(
      "A",
      "GET",
      `/v1/content/feeds/clip?limit=50&viewerProfileType=business&viewerProfileId=${BIZ1}`,
    );
    assert.ok(ids(acceptedBusinessFeed.json.items).includes(businessPost.postId));

    // Engagement must use the same active business identity as the feed.
    // Otherwise this followers-only post is returned by the feed but its
    // like/comment controls fail the visibility gate.
    const businessLike = await call(
      "A",
      "PUT",
      `/v1/content/posts/${businessPost.postId}/like?viewerProfileType=business&viewerProfileId=${BIZ1}`,
      { liked: true },
    );
    assert.equal(businessLike.status, 200, JSON.stringify(businessLike.json));
    assert.equal(businessLike.json.data.liked, true);
    const businessComment = await call(
      "A",
      "POST",
      `/v1/content/posts/${businessPost.postId}/comments`,
      {
        body: "Commenting as Asha Yoga Studio",
        publisherProfileId: BIZ1,
        publisherProfileType: "business",
      },
    );
    assert.equal(
      businessComment.status,
      201,
      JSON.stringify(businessComment.json),
    );
    assert.equal(businessComment.json.comment.publisher.id, BIZ1);
    const businessComments = await call(
      "A",
      "GET",
      `/v1/content/posts/${businessPost.postId}/comments?viewerProfileType=business&viewerProfileId=${BIZ1}`,
    );
    assert.equal(
      businessComments.status,
      200,
      JSON.stringify(businessComments.json),
    );
    assert.ok(
      businessComments.json.items.some(
        (comment: Json) => comment.id === businessComment.json.comment.id,
      ),
    );
  });
});

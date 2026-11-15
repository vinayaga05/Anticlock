import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, describe, it, mock } from "node:test";
import type {
  ObjectMetadata,
  ObjectStorageProvider,
  StorageBucket,
  UploadTarget,
} from "../media/ObjectStorageProvider.js";

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const MP4 = Buffer.concat([
  Buffer.from("000000206674797069736f6d0000020069736f6d69736f32", "hex"),
  Buffer.alloc(16),
]);
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Synthetic bytes only. A failing public URL method catches accidental private-media redirects. */
class BufferStorage implements ObjectStorageProvider {
  readonly name = "r2" as const;
  readonly objects = new Map<string, Buffer>();
  readonly puts: Array<{
    bucket: StorageBucket;
    key: string;
    contentType: string;
  }> = [];
  readonly reads: Array<{ bucket: StorageBucket; key: string }> = [];
  readonly deletes: Array<{ bucket: StorageBucket; key: string }> = [];
  downloadCalls = 0;
  deleteGate:
    | ((input: { bucket: StorageBucket; key: string }) => Promise<void>)
    | null = null;
  putGate:
    | ((input: {
        bucket: StorageBucket;
        key: string;
        body: Buffer;
      }) => Promise<void>)
    | null = null;
  readGate:
    | ((input: { bucket: StorageBucket; key: string }) => Promise<void>)
    | null = null;
  private path(input: { bucket: StorageBucket; key: string }) {
    return `${input.bucket}/${input.key}`;
  }
  async createUploadTarget(): Promise<UploadTarget> {
    throw new Error(
      "Direct uploads are forbidden in this private-media fixture."
    );
  }
  async putObject(input: {
    bucket: StorageBucket;
    key: string;
    body: Buffer;
    contentType: string;
    signal?: AbortSignal;
  }): Promise<void> {
    this.puts.push({
      bucket: input.bucket,
      key: input.key,
      contentType: input.contentType,
    });
    await this.putGate?.(input);
    if (input.signal?.aborted) throw new Error("Upload aborted");
    this.objects.set(this.path(input), Buffer.from(input.body));
  }
  async getObjectBuffer(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<Buffer> {
    this.reads.push(input);
    await this.readGate?.(input);
    const bytes = this.objects.get(this.path(input));
    if (!bytes) throw new Error("Synthetic object missing");
    return Buffer.from(bytes);
  }
  async getObjectPrefix(input: {
    bucket: StorageBucket;
    key: string;
    byteLength: number;
  }): Promise<Buffer> {
    return (await this.getObjectBuffer(input)).subarray(0, input.byteLength);
  }
  async finalizeUpload(): Promise<void> {
    throw new Error("A direct-upload promotion was not expected.");
  }
  async verifyObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<ObjectMetadata | null> {
    const bytes = this.objects.get(this.path(input));
    return bytes ? { byteSize: bytes.length } : null;
  }
  async deleteObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<void> {
    this.deletes.push(input);
    await this.deleteGate?.(input);
    this.objects.delete(this.path(input));
  }
  async createDownloadUrl(): Promise<string | null> {
    this.downloadCalls++;
    throw new Error("A private storage URL must never reach the API client.");
  }
}

describe(
  "Private fitness media with real PostgreSQL consent and synthetic object storage",
  { skip: !testDatabase },
  () => {
    const customer = randomUUID(),
      other = randomUUID(),
      trainer = randomUUID(),
      nutritionist = randomUUID(),
      unqualified = randomUUID(),
      raceOwner = randomUUID(),
      cleanupOwner = randomUUID(),
      gapOwner = randomUUID(),
      individualOwner = randomUUID();
    const trainerId = randomUUID(),
      nutritionId = randomUUID(),
      unqualifiedId = randomUUID(),
      trainerBooking = randomUUID();
    const users = [
        customer,
        other,
        trainer,
        nutritionist,
        unqualified,
        raceOwner,
        cleanupOwner,
        gapOwner,
        individualOwner,
      ],
      run = randomUUID();
    const tokens: Record<string, string> = {};
    const storage = new BufferStorage();
    let db: any,
      sqlClient: any,
      schema: any,
      app: any,
      media: any,
      fitness: any,
      decrypt: any;
    const replaced: Array<{ mock: { restore: () => void } }> = [];
    let first: any, second: any, workoutMedia: any, video: any;
    async function request(
      actor: string | null,
      method: string,
      path: string,
      body?: unknown
    ) {
      return app.request("/v1/fitness" + path, {
        method,
        headers: {
          ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}),
          ...(body === undefined || body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
            ? body
            : JSON.stringify(body),
      });
    }
    async function json(
      actor: string | null,
      method: string,
      path: string,
      body?: unknown
    ) {
      const response = await request(actor, method, path, body);
      return {
        status: response.status,
        body: (await response.json()) as any,
        headers: response.headers,
      };
    }
    function uploadForm(
      options: {
        requestId?: string;
        bytes?: Buffer;
        type?: string;
        purpose?: string;
        caption?: string;
        comparisonOptIn?: string;
      } = {}
    ) {
      const form = new FormData();
      form.set(
        "file",
        new File([new Uint8Array(options.bytes ?? PNG)], "synthetic-upload", {
          type: options.type ?? "image/png",
        })
      );
      form.set("purpose", options.purpose ?? "progress");
      form.set("clientRequestId", options.requestId ?? randomUUID());
      if (options.caption !== undefined) form.set("caption", options.caption);
      if (options.comparisonOptIn !== undefined)
        form.set("comparisonOptIn", options.comparisonOptIn);
      return form;
    }
    async function grant(
      ids: string[],
      scopes = ["media"],
      providerId = trainerId
    ) {
      const response = await json(customer, "PUT", `/consents/${providerId}`, {
        scopes,
        resourceIds: ids,
        confirmed: true,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
    }
    function assertPublicSafe(value: unknown) {
      const content = JSON.stringify(value);
      for (const prohibited of [
        "storageKey",
        "storageProvider",
        "private/fitness/",
        "private-documents",
        "checksum",
        "encryptedData",
        "r2.cloudflarestorage.com",
        "https://",
      ])
        assert(
          !content.includes(prohibited),
          `Private implementation detail leaked: ${prohibited}`
        );
    }
    before(async () => {
      process.env.FITNESS_DATA_ENCRYPTION_KEY ??= "7".repeat(64);
      const connection = await import("../db/client.js");
      db = connection.db;
      sqlClient = connection.sql;
      schema = await import("../db/schema.js");
      decrypt = (await import("../fitness/privacy.js")).decryptFitnessData;
      const serviceModule = await import("../fitness/FitnessMediaService.js");
      media = new serviceModule.FitnessMediaService(storage);
      const core = await import("../fitness/FitnessService.js");
      fitness = core.fitnessService;
      fitness.setMediaPurger((userId: string, tx: any) =>
        media.purge(userId, tx)
      );
      for (const name of [
        "upload",
        "list",
        "get",
        "update",
        "delete",
        "purge",
        "content",
        "ownedMealImage",
      ] as const)
        replaced.push(
          mock.method(
            serviceModule.fitnessMediaService,
            name,
            (media[name] as any).bind(media)
          ) as any
        );
      const { Hono } = await import("hono");
      const { fitnessMediaRoutes } = await import("./fitness-media.js");
      const { fitnessExpertRoutes } = await import("./fitness-experts.js");
      const { fitnessMobileRoutes } = await import("./fitness.js");
      app = new Hono()
        .route("/v1/fitness", fitnessMediaRoutes)
        .route("/v1/fitness", fitnessExpertRoutes)
        .route("/v1/fitness", fitnessMobileRoutes);
      const { signToken } = await import("../lib/auth.js");
      await db
        .insert(schema.mobileUsers)
        .values(
          users.map((id, index) => ({
            id,
            phone: `fitness-media-${run}-${index}`,
            displayName: [
              "Synthetic customer",
              "Other customer",
              "Trainer",
              "Nutritionist",
              "Unqualified provider",
              "Race-test customer",
              "Cleanup-test customer",
              "Reservation-gap customer",
              "Pending-item deletion customer",
            ][index],
          }))
        );
      for (const id of users)
        tokens[id] = await signToken({
          kind: "mobile",
          sub: id,
          name: "Synthetic media tester",
          email: "fixture@example.test",
          roles: [],
          permissions: [],
        });
      tokens.admin = await signToken({
        kind: "admin",
        sub: randomUUID(),
        name: "Admin fixture",
        email: "admin@example.test",
        roles: ["super_admin"],
        permissions: ["*"],
      });
      await db
        .insert(schema.serviceTrees)
        .values([
          { id: "fitness", slug: "fitness", name: "Fitness" },
          { id: "wellness", slug: "wellness", name: "Wellness" },
        ])
        .onConflictDoNothing();
      await db
        .insert(schema.serviceCategories)
        .values([
          {
            id: "fitness.personal_trainer",
            treeId: "fitness",
            name: "Personal Trainer",
          },
          {
            id: "wellness.nutrition_sports",
            treeId: "wellness",
            name: "Sports Nutrition",
          },
        ])
        .onConflictDoNothing();
      for (const [owner, id, category, payload] of [
        [
          trainer,
          trainerId,
          "fitness.personal_trainer",
          {
            trainer: {
              certifications: "Approved synthetic trainer qualification",
            },
          },
        ],
        [
          nutritionist,
          nutritionId,
          "wellness.nutrition_sports",
          {
            nutrition: { qualification: "Approved synthetic nutrition degree" },
          },
        ],
        [unqualified, unqualifiedId, "fitness.personal_trainer", {}],
      ] as const) {
        const applicationId = randomUUID();
        await db
          .insert(schema.providerApplications)
          .values({
            id: applicationId,
            mobileUserId: owner,
            providerKind: "individual",
            status: "approved",
            dynamicPayload: payload,
            reviewedAt: new Date(),
          });
        await db
          .insert(schema.providers)
          .values({
            id,
            mobileUserId: owner,
            providerKind: "individual",
            name: `Synthetic expert ${id}`,
            sourceApplicationId: applicationId,
          });
        const { eq } = await import("drizzle-orm");
        await db
          .update(schema.providerApplications)
          .set({ providerId: id })
          .where(eq(schema.providerApplications.id, applicationId));
        await db
          .insert(schema.providerApplicationServices)
          .values({ applicationId, categoryId: category });
        await db
          .insert(schema.providerServiceOfferings)
          .values({
            providerId: id,
            categoryId: category,
            pricingStartsAt: 500,
          });
        await db
          .insert(schema.bookings)
          .values({
            ...(id === trainerId ? { id: trainerBooking } : {}),
            mobileUserId: customer,
            providerId: id,
            categoryId: category,
            category: "Fitness",
            status: "confirmed",
            serviceMode: "online",
            startsAt: new Date(),
            durationMinutes: 30,
            detail: {},
          });
      }
    });
    after(async () => {
      storage.putGate = null;
      storage.readGate = null;
      for (const replacement of replaced) replacement.mock.restore();
      fitness?.configureDeleteHooks({});
      if (!db) return;
      try {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.mobileUsers)
          .where(inArray(schema.mobileUsers.id, users));
      } finally {
        await sqlClient.end({ timeout: 5 });
      }
    });
    it("uploads real synthetic image/video bytes into immutable private keys with encrypted metadata and default comparison off", async () => {
      const uploaded = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ caption: "Synthetic private caption" })
      );
      assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
      first = uploaded.body.media;
      assert.equal(first.kind, "image");
      assert.equal(first.comparisonOptIn, false);
      assert.equal(first.caption, "Synthetic private caption");
      assert.equal(first.url, `/v1/fitness/media/${first.id}/content`);
      assertPublicSafe(first);
      const { eq } = await import("drizzle-orm");
      const [record] = await db
        .select()
        .from(schema.progressMedia)
        .where(eq(schema.progressMedia.id, first.id));
      assert.equal(record.userId, customer);
      assert.equal(record.bucket, "private-documents");
      assert.match(
        record.storageKey,
        new RegExp(`^private/fitness/${customer}/${first.id}/original\\.png$`)
      );
      assert.equal(record.byteSize, PNG.length);
      assert(!record.encryptedData.includes("Synthetic private caption"));
      assert.equal(
        decrypt(customer, record.encryptedData).checksum,
        createHash("sha256").update(PNG).digest("hex")
      );
      const next = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ purpose: "progress", comparisonOptIn: "true" })
      );
      assert.equal(next.status, 201);
      second = next.body.media;
      assert.equal(second.comparisonOptIn, true);
      assert.equal(second.caption, undefined);
      assert.notEqual(first.id, second.id);
      const workout = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ purpose: "workout", comparisonOptIn: "true" })
      );
      assert.equal(workout.status, 201);
      workoutMedia = workout.body.media;
      assert.equal(workoutMedia.comparisonOptIn, false);
      const uploadedVideo = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ bytes: MP4, type: "video/mp4", purpose: "workout" })
      );
      assert.equal(uploadedVideo.status, 201);
      video = uploadedVideo.body.media;
      assert.equal(video.kind, "video");
      assert.equal(
        storage.puts.every((call) => call.bucket === "private-documents"),
        true
      );
      assert.equal(storage.downloadCalls, 0);
    });
    it("reuses an identical request without another put and rejects changed content or purpose", async () => {
      const requestId = randomUUID();
      const initial = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ requestId })
      );
      assert.equal(initial.status, 201);
      const puts = storage.puts.length;
      const retry = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ requestId })
      );
      assert.equal(retry.status, 201);
      assert.equal(retry.body.media.id, initial.body.media.id);
      assert.equal(storage.puts.length, puts);
      const changed = Buffer.from(PNG);
      changed[changed.length - 1] ^= 1;
      const content = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ requestId, bytes: changed })
      );
      assert.equal(content.status, 409);
      assert.equal(storage.puts.length, puts);
      const purpose = await json(
        customer,
        "POST",
        "/media/upload",
        uploadForm({ requestId, purpose: "meal" })
      );
      assert.equal(purpose.status, 409);
      const otherOwner = await json(
        other,
        "POST",
        "/media/upload",
        uploadForm({ requestId })
      );
      assert.equal(otherOwner.status, 201);
      assert.notEqual(otherOwner.body.media.id, initial.body.media.id);
    });
    it("returns exact bytes and valid byte ranges with authentication and private no-store headers", async () => {
      const response = await request(
        customer,
        "GET",
        `/media/${first.id}/content`
      );
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.equal(response.headers.get("content-length"), String(PNG.length));
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.equal(response.headers.get("vary"), "Authorization");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("location"), null);
      for (const [range, start, end] of [
        ["bytes=2-8", 2, 8],
        ["bytes=4-", 4, PNG.length - 1],
        ["bytes=-5", PNG.length - 5, PNG.length - 1],
      ] as const) {
        const result = await app.request(
          `/v1/fitness/media/${first.id}/content`,
          {
            headers: {
              Authorization: `Bearer ${tokens[customer]}`,
              Range: range,
            },
          }
        );
        assert.equal(result.status, 206);
        assert.deepEqual(
          Buffer.from(await result.arrayBuffer()),
          PNG.subarray(start, end + 1)
        );
        assert.equal(
          result.headers.get("content-range"),
          `bytes ${start}-${end}/${PNG.length}`
        );
      }
      for (const range of [
        "bytes=10000-",
        "bytes=9-1",
        "bytes=0-1,4-5",
        "invalid",
      ]) {
        const result = await app.request(
          `/v1/fitness/media/${first.id}/content`,
          {
            headers: {
              Authorization: `Bearer ${tokens[customer]}`,
              Range: range,
            },
          }
        );
        assert.equal(result.status, 416);
      }
      const videoBytes = await request(
        customer,
        "GET",
        `/media/${video.id}/content`
      );
      assert.equal(videoBytes.status, 200);
      assert.equal(videoBytes.headers.get("content-type"), "video/mp4");
      assert.deepEqual(Buffer.from(await videoBytes.arrayBuffer()), MP4);
    });
    it("denies signed-out, Admin, other-user and nonconsenting expert reads before object access", async () => {
      const reads = storage.reads.length;
      for (const [actor, status] of [
        [null, 401],
        ["admin", 403],
        [other, 403],
        [trainer, 403],
        [nutritionist, 403],
        [unqualified, 403],
      ] as const) {
        const result = await json(actor, "GET", `/media/${first.id}/content`);
        assert.equal(result.status, status, JSON.stringify(result.body));
        assertPublicSafe(result.body);
      }
      assert.equal(storage.reads.length, reads);
      const otherList = await json(other, "GET", "/media");
      assert.equal(otherList.status, 200);
      assert(!otherList.body.media.some((m: any) => m.id === first.id));
      const ownerList = await json(customer, "GET", "/media");
      assert.equal(ownerList.status, 200);
      assert(ownerList.body.media.some((m: any) => m.id === first.id));
      assertPublicSafe(ownerList.body);
    });
    it("requires the exact selected media permission, active booking and current approved professional identity", async () => {
      await grant([first.id]);
      const reads = storage.reads.length;
      const metadata = await json(
        trainer,
        "GET",
        `/media/${first.id}?providerId=${trainerId}`
      );
      assert.equal(metadata.status, 200);
      assert.equal(metadata.body.media.id, first.id);
      assertPublicSafe(metadata.body);
      const selected = await request(
        trainer,
        "GET",
        `/media/${first.id}/content?providerId=${trainerId}`
      );
      assert.equal(selected.status, 200);
      assert.deepEqual(Buffer.from(await selected.arrayBuffer()), PNG);
      assert.equal(storage.reads.length, reads + 1);
      const afterSelected = storage.reads.length;
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${second.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      assert.equal(storage.reads.length, afterSelected);
      await grant([], ["profile"]);
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      await grant([first.id]);
      const { eq } = await import("drizzle-orm");
      await db
        .update(schema.bookings)
        .set({ status: "cancelled" })
        .where(eq(schema.bookings.id, trainerBooking));
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      await db
        .update(schema.bookings)
        .set({ status: "confirmed" })
        .where(eq(schema.bookings.id, trainerBooking));
      const [provider] = await db
        .select()
        .from(schema.providers)
        .where(eq(schema.providers.id, trainerId));
      await db
        .update(schema.providerApplications)
        .set({ status: "rejected" })
        .where(
          eq(schema.providerApplications.id, provider.sourceApplicationId)
        );
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      await db
        .update(schema.providerApplications)
        .set({ status: "approved" })
        .where(
          eq(schema.providerApplications.id, provider.sourceApplicationId)
        );
      await db
        .insert(schema.mobileUserBlocks)
        .values({
          blockerMobileUserId: customer,
          blockedProviderId: trainerId,
        });
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      await db
        .delete(schema.mobileUserBlocks)
        .where(eq(schema.mobileUserBlocks.blockerMobileUserId, customer));
      await db
        .update(schema.providers)
        .set({ status: "deleted" })
        .where(eq(schema.providers.id, trainerId));
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      await db
        .update(schema.providers)
        .set({ status: "active" })
        .where(eq(schema.providers.id, trainerId));
      await grant([second.id], ["media"], nutritionId);
      const nutritionBytes = await request(
        nutritionist,
        "GET",
        `/media/${second.id}/content?providerId=${nutritionId}`
      );
      assert.equal(nutritionBytes.status, 200);
      assert.deepEqual(Buffer.from(await nutritionBytes.arrayBuffer()), PNG);
      assert.equal(
        (
          await json(
            nutritionist,
            "GET",
            `/media/${first.id}/content?providerId=${nutritionId}`
          )
        ).status,
        403
      );
      const readsBeforeAI = storage.reads.length;
      await assert.rejects(
        () => media.ownedMealImage(trainer, first.id),
        (error: any) => error.status === 403
      );
      await assert.rejects(
        () => media.ownedMealImage(customer, first.id),
        (error: any) => error.status === 403
      );
      assert.equal(storage.reads.length, readsBeforeAI);
    });
    it("revokes metadata and byte access immediately without another object read", async () => {
      await grant([first.id]);
      const reads = storage.reads.length;
      assert.equal(
        (await json(customer, "DELETE", `/consents/${trainerId}`)).status,
        200
      );
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}?providerId=${trainerId}`
          )
        ).status,
        403
      );
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        403
      );
      assert.equal(storage.reads.length, reads);
      const owned = await request(
        customer,
        "GET",
        `/media/${first.id}/content`
      );
      assert.equal(owned.status, 200);
    });
    it("lets only owners edit captions/comparison and never enables comparisons for workout media", async () => {
      await grant([first.id]);
      assert.equal(
        (
          await json(trainer, "PATCH", `/media/${first.id}`, {
            caption: "Not the owner",
          })
        ).status,
        403
      );
      assert.equal(
        (
          await json(other, "PATCH", `/media/${first.id}`, {
            caption: "Other user",
          })
        ).status,
        403
      );
      const update = await json(customer, "PATCH", `/media/${first.id}`, {
        caption: "Updated synthetic caption",
        comparisonOptIn: true,
      });
      assert.equal(update.status, 200);
      assert.equal(update.body.media.caption, "Updated synthetic caption");
      assert.equal(update.body.media.comparisonOptIn, true);
      assertPublicSafe(update.body);
      const workout = await json(
        customer,
        "PATCH",
        `/media/${workoutMedia.id}`,
        { comparisonOptIn: true }
      );
      assert.equal(workout.status, 200);
      assert.equal(workout.body.media.comparisonOptIn, false);
    });
    it("removes an individual object and private caption metadata while keeping a nonreadable idempotency tombstone", async () => {
      const { eq } = await import("drizzle-orm");
      const [record] = await db
        .select()
        .from(schema.progressMedia)
        .where(eq(schema.progressMedia.id, first.id));
      assert.equal(
        (await json(other, "DELETE", `/media/${first.id}`)).status,
        404
      );
      assert.equal(
        (await json(customer, "DELETE", `/media/${first.id}`)).status,
        200
      );
      assert.equal(
        storage.objects.has(`${record.bucket}/${record.storageKey}`),
        false
      );
      assert.equal(
        (await json(customer, "GET", `/media/${first.id}`)).status,
        404
      );
      assert.equal(
        (
          await json(
            trainer,
            "GET",
            `/media/${first.id}/content?providerId=${trainerId}`
          )
        ).status,
        404
      );
      const [deleted] = await db
        .select()
        .from(schema.progressMedia)
        .where(eq(schema.progressMedia.id, first.id));
      assert.equal(deleted.status, "deleted");
      assert(deleted.deletedAt);
      assert.equal(
        deleted.encryptedData === null,
        true,
        "Private captions must not remain after deleting the item."
      );
      assert.equal(
        (await json(customer, "DELETE", `/media/${first.id}`)).status,
        200
      );
    });
    it("fails a storage upload without retaining a readable row or object and rejects invalid bytes", async () => {
      const requestId = randomUUID();
      storage.putGate = async () => {
        throw new Error("Synthetic object-store failure");
      };
      try {
        const failed = await json(
          customer,
          "POST",
          "/media/upload",
          uploadForm({ requestId })
        );
        assert.equal(failed.status, 409);
        assert(!JSON.stringify(failed.body).includes("Synthetic object-store"));
      } finally {
        storage.putGate = null;
      }
      const { eq, and } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(schema.progressMedia)
        .where(
          and(
            eq(schema.progressMedia.userId, customer),
            eq(schema.progressMedia.clientRequestId, requestId)
          )
        );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "cleanup_pending");
      assert.equal(
        storage.objects.has(`${rows[0].bucket}/${rows[0].storageKey}`),
        false
      );
      assert.equal(
        (await json(customer, "GET", `/media/${rows[0].id}`)).status,
        404
      );
      const puts = storage.puts.length;
      for (const options of [
        { bytes: Buffer.from("not an image") },
        { bytes: PNG, type: "video/mp4" },
        { comparisonOptIn: "maybe" },
      ])
        assert.equal(
          (await json(customer, "POST", "/media/upload", uploadForm(options)))
            .status,
          400
        );
      assert.equal(storage.puts.length, puts);
    });
    it("retains retryable ownership when an uncertain failed put cannot be cleaned immediately", async () => {
      const requestId = randomUUID();
      const originalDelete = storage.deleteObject.bind(storage);
      const failingDelete = mock.method(
        storage,
        "deleteObject",
        async (input) => {
          if (input.key.includes(cleanupOwner))
            throw new Error("Synthetic cleanup outage");
          return originalDelete(input);
        }
      );
      storage.putGate = async (input) => {
        if (input.key.includes(cleanupOwner)) {
          storage.objects.set(
            `${input.bucket}/${input.key}`,
            Buffer.from(input.body)
          );
          throw new Error("Synthetic response lost after durable put");
        }
      };
      try {
        const failed = await json(
          cleanupOwner,
          "POST",
          "/media/upload",
          uploadForm({
            requestId,
            caption: "Synthetic uncertain-upload caption",
          })
        );
        assert([409, 503].includes(failed.status));
        assertPublicSafe(failed.body);
        const remaining = [...storage.objects.keys()].filter((key) =>
          key.includes(cleanupOwner)
        );
        assert.equal(remaining.length, 1);
        const { eq, and } = await import("drizzle-orm");
        const tracked = await db
          .select()
          .from(schema.progressMedia)
          .where(
            and(
              eq(schema.progressMedia.userId, cleanupOwner),
              eq(schema.progressMedia.clientRequestId, requestId)
            )
          );
        assert.equal(
          tracked.length,
          1,
          "An uncertain private object needs a retryable owner row so account/data deletion can remove it."
        );
        assert.notEqual(tracked[0].status, "ready");
        assert.equal(
          (await json(cleanupOwner, "GET", "/media")).body.media.length,
          0
        );
        failingDelete.mock.restore();
        storage.putGate = null;
        const recovered = await media.cleanupPending(
          new Date(Date.now() + 11 * 60000)
        );
        assert(recovered >= 1);
        assert.equal(
          [...storage.objects.keys()].some((key) => key.includes(cleanupOwner)),
          false
        );
        const [failedRecord] = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.id, tracked[0].id));
        assert.equal(failedRecord.status, "failed");
        assert.equal(
          decrypt(cleanupOwner, failedRecord.encryptedData).caption,
          undefined
        );
        const retry = await json(
          cleanupOwner,
          "POST",
          "/media/upload",
          uploadForm({ requestId })
        );
        assert.equal(retry.status, 201);
        assert.notEqual(retry.body.media.id, tracked[0].id);
        const [fresh] = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.id, retry.body.media.id));
        assert.notEqual(fresh.storageKey, tracked[0].storageKey);
        await media.cleanupPending(new Date(Date.now() + 11 * 60000));
        assert.equal(
          (
            await db
              .select()
              .from(schema.progressMedia)
              .where(eq(schema.progressMedia.id, tracked[0].id))
          ).length,
          0
        );
        assert.equal(
          (await json(cleanupOwner, "GET", `/media/${fresh.id}`)).status,
          200
        );
        const purge = await json(cleanupOwner, "DELETE", "/data");
        assert.equal(purge.status, 200);
        assert.equal(
          [...storage.objects.keys()].some((key) => key.includes(cleanupOwner)),
          false
        );
        assert.equal(
          (
            await db
              .select()
              .from(schema.progressMedia)
              .where(eq(schema.progressMedia.userId, cleanupOwner))
          ).length,
          0
        );
      } finally {
        failingDelete.mock.restore();
        storage.putGate = null;
        for (const key of storage.objects.keys())
          if (key.includes(cleanupOwner)) storage.objects.delete(key);
      }
    });
    it("purges stored objects and all owner fitness metadata through the real data-deletion route", async () => {
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(schema.progressMedia)
        .where(eq(schema.progressMedia.userId, customer));
      const response = await json(customer, "DELETE", "/data");
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(
        (
          await db
            .select()
            .from(schema.progressMedia)
            .where(eq(schema.progressMedia.userId, customer))
        ).length,
        0
      );
      for (const row of rows)
        assert.equal(
          storage.objects.has(`${row.bucket}/${row.storageKey}`),
          false
        );
      assert.equal(
        (await json(customer, "GET", "/media")).body.media.length,
        0
      );
    });
    it("serializes account deletion behind an in-flight upload so the late object cannot survive account cleanup", async () => {
      const putStarted = deferred(),
        releasePut = deferred();
      storage.putGate = async (input) => {
        if (input.key.includes(raceOwner)) {
          putStarted.resolve();
          await releasePut.promise;
        }
      };
      const { sql, eq } = await import("drizzle-orm");
      const original = db.transaction.bind(db);
      const instrument = mock.method(
        db,
        "transaction",
        (callback: any, ...options: any[]) =>
          original(async (tx: any) => {
            await tx.execute(
              sql`select set_config('application_name',${run},true)`
            );
            return callback(tx);
          }, ...options)
      );
      let uploadPromise: Promise<any> | undefined,
        deletePromise: Promise<any> | undefined;
      let deletionFinished = false;
      try {
        uploadPromise = media.upload(raceOwner, {
          bytes: PNG,
          contentType: "image/png",
          purpose: "progress",
          clientRequestId: randomUUID(),
        });
        await putStarted.promise;
        const reserved = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.userId, raceOwner));
        assert.equal(reserved.length, 1);
        assert.equal(
          reserved[0].status,
          "pending",
          "Storage writes must have a committed owner reservation before they begin."
        );
        deletePromise = fitness
          .deleteData(raceOwner, { deactivateAccount: true })
          .then(() => {
            deletionFinished = true;
          });
        let waiting = false;
        for (let attempt = 0; attempt < 200 && !waiting; attempt++) {
          const rows = await db.execute(
            sql`select pid from pg_stat_activity where application_name=${run} and wait_event_type='Lock' and query ilike '%mobile_users%'`
          );
          waiting = rows.length > 0;
          if (deletionFinished) break;
        }
        assert.equal(
          waiting,
          true,
          "The data-deletion transaction must wait on the owner row held by the pending upload."
        );
        assert.equal(deletionFinished, false);
        releasePut.resolve();
        await uploadPromise;
        await deletePromise;
        const rows = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.userId, raceOwner));
        assert.equal(rows.length, 0);
        assert.equal(
          [...storage.objects.keys()].some((key) => key.includes(raceOwner)),
          false
        );
        const [owner] = await db
          .select()
          .from(schema.mobileUsers)
          .where(eq(schema.mobileUsers.id, raceOwner));
        assert.equal(owner.isActive, false);
        await assert.rejects(
          () =>
            media.upload(raceOwner, {
              bytes: PNG,
              contentType: "image/png",
              purpose: "progress",
              clientRequestId: randomUUID(),
            }),
          (error: any) => error.status === 403
        );
      } finally {
        releasePut.resolve();
        storage.putGate = null;
        await Promise.allSettled(
          [uploadPromise, deletePromise].filter(Boolean) as Promise<unknown>[]
        );
        instrument.mock.restore();
      }
    });
    it("does not write an object when data deletion clears the committed reservation before the put transaction", async () => {
      const { eq } = await import("drizzle-orm");
      const original = db.transaction.bind(db);
      let calls = 0;
      const gap = deferred(),
        resume = deferred();
      const pause = mock.method(
        db,
        "transaction",
        (callback: any, ...args: any[]) => {
          calls++;
          if (calls === 2) {
            gap.resolve();
            return resume.promise.then(() => original(callback, ...args));
          }
          return original(callback, ...args);
        }
      );
      let pending: Promise<any> | undefined;
      const puts = storage.puts.length;
      try {
        pending = media.upload(gapOwner, {
          bytes: PNG,
          contentType: "image/png",
          purpose: "progress",
          clientRequestId: randomUUID(),
        });
        await Promise.race([
          gap.promise,
          pending.then(() => {
            throw new Error("No durable reservation boundary was reached.");
          }),
        ]);
        const reserved = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.userId, gapOwner));
        assert.equal(reserved.length, 1);
        assert.equal(reserved[0].status, "pending");
        await fitness.deleteData(gapOwner);
        resume.resolve();
        await assert.rejects(
          pending,
          (error: any) =>
            error.status === 409 && error.code === "upload_cleared"
        );
        assert.equal(storage.puts.length, puts);
        assert.equal(
          (
            await db
              .select()
              .from(schema.progressMedia)
              .where(eq(schema.progressMedia.userId, gapOwner))
          ).length,
          0
        );
        assert.equal(
          [...storage.objects.keys()].some((key) => key.includes(gapOwner)),
          false
        );
      } finally {
        resume.resolve();
        if (pending) await Promise.allSettled([pending]);
        pause.mock.restore();
      }
    });

    it("serializes individual deletion after a pending put so late bytes cannot survive the deleted item", async () => {
      const putStarted = deferred(),
        releasePut = deferred();
      let released = false,
        deletedBeforePut = false;
      storage.putGate = async (input) => {
        if (input.key.includes(individualOwner)) {
          putStarted.resolve();
          await releasePut.promise;
        }
      };
      storage.deleteGate = async (input) => {
        if (input.key.includes(individualOwner) && !released)
          deletedBeforePut = true;
      };
      const { sql, eq } = await import("drizzle-orm");
      const label = `${run}-individual`,
        original = db.transaction.bind(db);
      const instrument = mock.method(
        db,
        "transaction",
        (callback: any, ...args: any[]) =>
          original(async (tx: any) => {
            await tx.execute(
              sql`select set_config('application_name',${label},true)`
            );
            return callback(tx);
          }, ...args)
      );
      let pending: Promise<any> | undefined, removal: Promise<any> | undefined;
      try {
        pending = media.upload(individualOwner, {
          bytes: PNG,
          contentType: "image/png",
          purpose: "progress",
          clientRequestId: randomUUID(),
        });
        await putStarted.promise;
        const [reserved] = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.userId, individualOwner));
        assert.equal(reserved.status, "pending");
        removal = media.delete(individualOwner, reserved.id);
        let waiting = false;
        for (
          let attempt = 0;
          attempt < 200 && !waiting && !deletedBeforePut;
          attempt++
        ) {
          const locks = await db.execute(
            sql`select pid from pg_stat_activity where application_name=${label} and wait_event_type='Lock' and query ilike '%mobile_users%'`
          );
          waiting = locks.length > 0;
        }
        assert.equal(
          deletedBeforePut,
          false,
          "Deleting an object before its pending PUT finishes can leave private bytes behind."
        );
        assert.equal(waiting, true);
        released = true;
        releasePut.resolve();
        await pending;
        await removal;
        assert.equal(
          [...storage.objects.keys()].some((key) =>
            key.includes(individualOwner)
          ),
          false
        );
        const [deleted] = await db
          .select()
          .from(schema.progressMedia)
          .where(eq(schema.progressMedia.id, reserved.id));
        assert.equal(deleted.status, "deleted");
        assert.equal(deleted.encryptedData === null, true);
      } finally {
        released = true;
        releasePut.resolve();
        storage.putGate = null;
        storage.deleteGate = null;
        await Promise.allSettled(
          [pending, removal].filter(Boolean) as Promise<unknown>[]
        );
        instrument.mock.restore();
        for (const key of storage.objects.keys())
          if (key.includes(individualOwner)) storage.objects.delete(key);
      }
    });
  }
);

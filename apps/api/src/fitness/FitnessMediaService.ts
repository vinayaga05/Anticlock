import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type {
  FitnessMediaPurpose,
  FitnessProgressMedia,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import { mobileUsers, progressMedia } from "../db/schema.js";
import { ApiError } from "../lib/httpError.js";
import { LocalObjectStorageProvider } from "../media/LocalObjectStorageProvider.js";
import { R2ObjectStorageProvider } from "../media/R2ObjectStorageProvider.js";
import {
  extensionForMime,
  type ObjectStorageProvider,
} from "../media/ObjectStorageProvider.js";
import { validateAvatarUpload } from "../media/validateAvatarUpload.js";
import { detectMimeFromMagic } from "../media/validateUpload.js";
import { decryptFitnessData, encryptFitnessData } from "./privacy.js";
import { fitnessExpertService } from "./FitnessExpertService.js";
import type { FitnessTransaction } from "./FitnessService.js";

export const MAX_FITNESS_VIDEO_BYTES = 25 * 1024 * 1024;
type FitnessMediaRecord = typeof progressMedia.$inferSelect;
type PrivateMetadata = {
  caption?: string;
  comparisonOptIn: boolean;
  checksum: string;
};
const unavailable = () =>
  new ApiError(
    409,
    "private_media_unavailable",
    "Private media is temporarily unavailable. Please try again."
  );
async function storageDeadline<T>(
  operation: Promise<T>,
  milliseconds = 20_000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(unavailable()), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class FitnessMediaService {
  constructor(private readonly injectedStorage?: ObjectStorageProvider) {}
  private storage(provider?: string): ObjectStorageProvider {
    if (this.injectedStorage) return this.injectedStorage;
    const selected =
      provider ??
      process.env.MEDIA_STORAGE ??
      (process.env.NODE_ENV === "production" ? "r2" : "local");
    if (selected === "r2") {
      if (
        !process.env.R2_ACCOUNT_ID?.trim() ||
        !process.env.R2_ACCESS_KEY_ID?.trim() ||
        !process.env.R2_SECRET_ACCESS_KEY?.trim()
      )
        throw unavailable();
      return new R2ObjectStorageProvider();
    }
    if (process.env.NODE_ENV === "production" || selected !== "local")
      throw unavailable();
    return new LocalObjectStorageProvider();
  }
  private async activeUser(
    userId: string,
    executor: typeof db | FitnessTransaction = db
  ) {
    const [row] = await executor
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
      .limit(1);
    if (!row)
      throw new ApiError(403, "forbidden", "An active account is required.");
  }
  private metadata(
    row: FitnessMediaRecord,
    includeUrl = true
  ): FitnessProgressMedia {
    const data = row.encryptedData
      ? decryptFitnessData<PrivateMetadata>(row.userId, row.encryptedData)
      : { caption: undefined, comparisonOptIn: false };
    return {
      id: row.id,
      kind: row.kind as "image" | "video",
      purpose: row.purpose as FitnessMediaPurpose,
      createdAt: row.createdAt.toISOString(),
      caption: data.caption,
      comparisonOptIn: data.comparisonOptIn === true,
      ...(includeUrl ? { url: `/v1/fitness/media/${row.id}/content` } : {}),
    };
  }
  async list(userId: string): Promise<FitnessProgressMedia[]> {
    await this.activeUser(userId);
    const rows = await db
      .select()
      .from(progressMedia)
      .where(
        and(
          eq(progressMedia.userId, userId),
          eq(progressMedia.status, "ready"),
          isNull(progressMedia.deletedAt)
        )
      )
      .orderBy(desc(progressMedia.createdAt))
      .limit(100);
    return rows.map((row) => this.metadata(row));
  }
  async upload(
    userId: string,
    input: {
      bytes: Buffer;
      contentType: string;
      purpose: FitnessMediaPurpose;
      clientRequestId: string;
      caption?: string;
      comparisonOptIn?: boolean;
    }
  ): Promise<FitnessProgressMedia> {
    await this.activeUser(userId);
    const mime = input.contentType.toLowerCase().split(";")[0]?.trim();
    let kind: "image" | "video";
    if (mime === "video/mp4") {
      if (
        input.bytes.length < 32 ||
        input.bytes.length > MAX_FITNESS_VIDEO_BYTES ||
        detectMimeFromMagic(input.bytes) !== "video/mp4"
      )
        throw new ApiError(
          400,
          "invalid_video",
          "Choose an MP4 video up to25MB."
        );
      kind = "video";
    } else {
      validateAvatarUpload(input.bytes, mime ?? "");
      kind = "image";
    }
    const checksum = createHash("sha256").update(input.bytes).digest("hex");
    const storage = this.storage();
    // Commit ownership before storage writes. A process crash or uncertain PUT
    // must leave a durable cleanup record, not an untraceable private object.
    const reserved = await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ id: mobileUsers.id })
        .from(mobileUsers)
        .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
        .for("update");
      if (!owner)
        throw new ApiError(403, "forbidden", "An active account is required.");
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${
          "fitness-media:" + userId + ":" + input.clientRequestId
        },0))`
      );
      const [existing] = await tx
        .select()
        .from(progressMedia)
        .where(
          and(
            eq(progressMedia.userId, userId),
            eq(progressMedia.clientRequestId, input.clientRequestId)
          )
        )
        .limit(1);
      if (existing) {
        const data = existing.encryptedData
          ? decryptFitnessData<PrivateMetadata>(userId, existing.encryptedData)
          : null;
        if (
          existing.deletedAt ||
          data?.checksum !== checksum ||
          existing.purpose !== input.purpose
        )
          throw new ApiError(
            409,
            "media_request_conflict",
            "Choose the file again before uploading."
          );
        if (existing.status === "ready") return existing;
        if (
          existing.status === "pending" &&
          existing.createdAt.getTime() > Date.now() - 120_000
        )
          throw new ApiError(
            409,
            "upload_in_progress",
            "Your upload is still being confirmed. Wait a moment and retry."
          );
        // Retry with a fresh immutable key; the old key remains tracked until
        // cleanup, including a previous PUT that finishes unusually late.
        await tx
          .update(progressMedia)
          .set({ clientRequestId: null, status: "cleanup_pending" })
          .where(eq(progressMedia.id, existing.id));
      }
      const id = randomUUID(),
        key = `private/fitness/${userId}/${id}/original.${extensionForMime(
          mime!
        )}`;
      const [row] = await tx
        .insert(progressMedia)
        .values({
          id,
          userId,
          purpose: input.purpose,
          kind,
          storageProvider: storage.name,
          storageKey: key,
          bucket: "private-documents",
          contentType: mime!,
          byteSize: input.bytes.length,
          clientRequestId: input.clientRequestId,
          encryptedData: encryptFitnessData(userId, {
            caption: input.caption,
            comparisonOptIn:
              input.purpose === "progress" && input.comparisonOptIn === true,
            checksum,
          } satisfies PrivateMetadata),
          status: "pending",
        })
        .returning();
      return row!;
    });
    if (reserved.status === "ready") return this.metadata(reserved);
    const result = await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ id: mobileUsers.id })
        .from(mobileUsers)
        .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
        .for("update");
      if (!owner)
        throw new ApiError(403, "forbidden", "An active account is required.");
      const [pending] = await tx
        .select()
        .from(progressMedia)
        .where(
          and(
            eq(progressMedia.id, reserved.id),
            eq(progressMedia.userId, userId),
            eq(progressMedia.status, "pending"),
            isNull(progressMedia.deletedAt)
          )
        )
        .for("update");
      if (!pending)
        throw new ApiError(
          409,
          "upload_cleared",
          "This upload was cleared. Choose the file again."
        );
      const key = pending.storageKey;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abandoned = false;
      const upload = storage.putObject({
        bucket: "private-documents",
        key,
        body: input.bytes,
        contentType: mime!,
        signal: controller.signal,
      });
      void upload.then(
        async () => {
          if (abandoned)
            await storageDeadline(
              storage.deleteObject({ bucket: "private-documents", key })
            ).catch(() => {});
        },
        () => {}
      );
      try {
        await Promise.race([
          upload,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(unavailable());
            }, 45_000);
          }),
        ]);
        const [created] = await tx
          .update(progressMedia)
          .set({ status: "ready" })
          .where(
            and(
              eq(progressMedia.id, pending.id),
              eq(progressMedia.status, "pending"),
              isNull(progressMedia.deletedAt)
            )
          )
          .returning();
        if (!created) throw unavailable();
        return { media: this.metadata(created) };
      } catch (error) {
        abandoned = true;
        // Keys are immutable and never reused by another user/request.
        await storageDeadline(
          storage.deleteObject({ bucket: "private-documents", key })
        ).catch(() => {});
        await tx
          .update(progressMedia)
          .set({ status: "cleanup_pending" })
          .where(eq(progressMedia.id, pending.id));
        // Return an error value so cleanup ownership COMMITs before throwing.
        return { error: error instanceof ApiError ? error : unavailable() };
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
    if (result.error) throw result.error;
    return result.media!;
  }
  private async record(
    actorId: string,
    id: string,
    providerId?: string
  ): Promise<FitnessMediaRecord> {
    await this.activeUser(actorId);
    const [row] = await db
      .select()
      .from(progressMedia)
      .where(
        and(
          eq(progressMedia.id, id),
          eq(progressMedia.status, "ready"),
          isNull(progressMedia.deletedAt)
        )
      )
      .limit(1);
    if (!row) throw new ApiError(404, "not_found", "Media not found.");
    await this.activeUser(row.userId);
    if (actorId !== row.userId)
      await fitnessExpertService.assertResourceAccess(
        actorId,
        row.userId,
        "media",
        row.id,
        providerId
      );
    return row;
  }
  async get(actorId: string, id: string, providerId?: string) {
    return this.metadata(await this.record(actorId, id, providerId));
  }
  async update(
    userId: string,
    id: string,
    input: { caption?: string; comparisonOptIn?: boolean }
  ) {
    const row = await this.record(userId, id);
    if (row.userId !== userId)
      throw new ApiError(
        403,
        "forbidden",
        "Only the owner can change private media."
      );
    const data = decryptFitnessData<PrivateMetadata>(
      userId,
      row.encryptedData!
    );
    const [updated] = await db
      .update(progressMedia)
      .set({
        encryptedData: encryptFitnessData(userId, {
          ...data,
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.comparisonOptIn !== undefined
            ? {
                comparisonOptIn:
                  row.purpose === "progress" && input.comparisonOptIn,
              }
            : {}),
        }),
      })
      .where(
        and(
          eq(progressMedia.id, id),
          eq(progressMedia.userId, userId),
          isNull(progressMedia.deletedAt)
        )
      )
      .returning();
    if (!updated) throw new ApiError(404, "not_found", "Media not found.");
    return this.metadata(updated);
  }
  async delete(userId: string, id: string) {
    await this.activeUser(userId);
    await db.transaction(async (tx) => {
      // A pending PUT owns this same row lock. Delete the object only after
      // that write commits so late bytes cannot survive a deleted tombstone.
      const [owner] = await tx
        .select({ id: mobileUsers.id })
        .from(mobileUsers)
        .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
        .for("update");
      if (!owner)
        throw new ApiError(403, "forbidden", "An active account is required.");
      const [row] = await tx
        .select()
        .from(progressMedia)
        .where(and(eq(progressMedia.id, id), eq(progressMedia.userId, userId)))
        .for("update")
        .limit(1);
      if (!row) throw new ApiError(404, "not_found", "Media not found.");
      if (row.deletedAt) return;
      try {
        await storageDeadline(
          this.storage(row.storageProvider).deleteObject({
            bucket: "private-documents",
            key: row.storageKey,
          })
        );
      } catch {
        throw unavailable();
      }
      await tx
        .update(progressMedia)
        .set({ deletedAt: new Date(), status: "deleted", encryptedData: null })
        .where(and(eq(progressMedia.id, id), eq(progressMedia.userId, userId)));
    });
  }
  async purge(userId: string, executor: typeof db | FitnessTransaction = db) {
    await this.activeUser(userId, executor);
    const rows = await executor
      .select()
      .from(progressMedia)
      .where(
        and(eq(progressMedia.userId, userId), isNull(progressMedia.deletedAt))
      );
    for (const row of rows) {
      try {
        await storageDeadline(
          this.storage(row.storageProvider).deleteObject({
            bucket: "private-documents",
            key: row.storageKey,
          })
        );
      } catch {
        throw unavailable();
      }
      await executor
        .update(progressMedia)
        .set({ deletedAt: new Date(), status: "deleted", encryptedData: null })
        .where(eq(progressMedia.id, row.id));
    }
  }
  async ownedMealImage(
    userId: string,
    id: string
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const row = await this.record(userId, id);
    if (row.userId !== userId || row.kind !== "image" || row.purpose !== "meal")
      throw new ApiError(403, "forbidden", "Choose your own meal photo.");
    return {
      bytes: await storageDeadline(
        this.storage(row.storageProvider).getObjectBuffer({
          bucket: "private-documents",
          key: row.storageKey,
        }),
        15_000
      ),
      contentType: row.contentType,
    };
  }
  /** Reclaims uncertain/abandoned writes. No public API can read these rows. */
  async cleanupPending(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 10 * 60_000);
    const rows = await db
      .select({ id: progressMedia.id, userId: progressMedia.userId })
      .from(progressMedia)
      .where(
        and(
          inArray(progressMedia.status, ["pending", "cleanup_pending"]),
          isNull(progressMedia.deletedAt),
          lte(progressMedia.createdAt, cutoff)
        )
      )
      .orderBy(asc(progressMedia.createdAt))
      .limit(100);
    let cleaned = 0;
    for (const item of rows) {
      try {
        await db.transaction(async (tx) => {
          await tx
            .select({ id: mobileUsers.id })
            .from(mobileUsers)
            .where(eq(mobileUsers.id, item.userId))
            .for("update");
          const [row] = await tx
            .select()
            .from(progressMedia)
            .where(
              and(
                eq(progressMedia.id, item.id),
                inArray(progressMedia.status, ["pending", "cleanup_pending"]),
                isNull(progressMedia.deletedAt)
              )
            )
            .for("update");
          if (!row) return;
          await storageDeadline(
            this.storage(row.storageProvider).deleteObject({
              bucket: "private-documents",
              key: row.storageKey,
            })
          );
          if (!row.clientRequestId)
            await tx.delete(progressMedia).where(eq(progressMedia.id, row.id));
          else {
            const data = row.encryptedData
              ? decryptFitnessData<PrivateMetadata>(
                  row.userId,
                  row.encryptedData
                )
              : null;
            await tx
              .update(progressMedia)
              .set({
                status: "failed",
                encryptedData: data
                  ? encryptFitnessData(row.userId, {
                      checksum: data.checksum,
                      comparisonOptIn: false,
                    })
                  : null,
              })
              .where(eq(progressMedia.id, row.id));
          }
          cleaned += 1;
        });
      } catch {
        console.error("[fitness] private_media_cleanup_pending");
      }
    }
    return cleaned;
  }
  /** No signed R2 URL reaches the client. Every request checks current consent. */
  async content(
    actorId: string,
    id: string,
    providerId?: string,
    range?: string
  ): Promise<Response> {
    const row = await this.record(actorId, id, providerId);
    if (range && !/^bytes=\d*-\d*$/.test(range))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${row.byteSize}` },
      });
    const storage = this.storage(row.storageProvider);
    const headers: Record<string, string> = {
      "Content-Type": row.contentType,
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="fitness-media.${extensionForMime(
        row.contentType
      )}"`,
    };
    if (storage.name === "local" || this.injectedStorage) {
      const bytes = await storageDeadline(
        storage.getObjectBuffer({
          bucket: "private-documents",
          key: row.storageKey,
        }),
        15_000
      );
      if (!range)
        return new Response(new Uint8Array(bytes), {
          headers: { ...headers, "Content-Length": String(bytes.length) },
        });
      const [startText, endText] = range.slice(6).split("-");
      const start = startText
        ? Number(startText)
        : Math.max(0, bytes.length - Number(endText));
      const end = startText
        ? Math.min(
            endText ? Number(endText) : bytes.length - 1,
            bytes.length - 1
          )
        : bytes.length - 1;
      if (start > end || start >= bytes.length || !Number.isFinite(start))
        return new Response(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
        });
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        },
      });
    }
    const url = await storage.createDownloadUrl({
      bucket: "private-documents",
      key: row.storageKey,
      accessLevel: "private",
      expiresInSeconds: 60,
    });
    if (!url || new URL(url).protocol !== "https:") throw unavailable();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(url, {
        headers: range ? { Range: range } : {},
        signal: controller.signal,
        redirect: "error",
      });
      if (response.status === 416) {
        clearTimeout(timer);
        await response.body?.cancel().catch(() => {});
        controller.abort();
        return new Response(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${row.byteSize}` },
        });
      }
      if (!response.ok || !response.body) throw unavailable();
      for (const name of ["Content-Length", "Content-Range"]) {
        const value = response.headers.get(name);
        if (value) headers[name] = value;
      }
      const reader = response.body.getReader();
      const body = new ReadableStream({
        async pull(stream) {
          try {
            const chunk = await reader.read();
            if (chunk.done) {
              clearTimeout(timer);
              stream.close();
            } else stream.enqueue(chunk.value);
          } catch {
            clearTimeout(timer);
            stream.error(new Error("Private media transfer interrupted."));
          }
        },
        async cancel() {
          clearTimeout(timer);
          controller.abort();
          await reader.cancel();
        },
      });
      return new Response(body, { status: response.status, headers });
    } catch {
      clearTimeout(timer);
      controller.abort();
      throw unavailable();
    }
  }
}
export const fitnessMediaService = new FitnessMediaService();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
export function startFitnessMediaCleanupJob() {
  if (cleanupTimer || process.env.NODE_ENV === "test") return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await fitnessMediaService.cleanupPending();
    } catch {
      console.error("[fitness] private_media_cleanup_unavailable");
    } finally {
      running = false;
    }
  };
  cleanupTimer = setInterval(() => {
    void run();
  }, 60_000);
  cleanupTimer.unref();
}

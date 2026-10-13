import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaAccessLevel, MediaTransform } from '@anticlock/contracts';
import type {
  ObjectMetadata,
  ObjectStorageProvider,
  StorageBucket,
  UploadTarget,
} from './ObjectStorageProvider.js';

function bucketName(bucket: StorageBucket): string {
  if (bucket === 'private-documents') {
    return process.env.R2_BUCKET_PRIVATE ?? 'anticlock-private-documents';
  }
  return process.env.R2_BUCKET_PUBLIC ?? 'anticlock-public-media';
}

/** Public delivery URLs are only valid when this bucket has a configured CDN/custom domain. */
export function r2PublicDeliveryUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  const encodedKey = key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${base}/${encodedKey}`;
}

export class R2ObjectStorageProvider implements ObjectStorageProvider {
  readonly name = 'r2' as const;
  private client: S3Client;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const endpoint =
      process.env.R2_ENDPOINT ??
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    if (
      !endpoint ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY
    ) {
      throw new Error('R2 credentials are not configured');
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * KYC photos are signed directly to the private bucket. A missing bucket
   * makes that PUT return 404, so create it once when the API starts.
   */
  async ensurePrivateBucket(): Promise<void> {
    const Bucket = bucketName('private-documents');
    try {
      await this.client.send(new HeadBucketCommand({ Bucket }));
      return;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status !== 404) {
        console.warn(
          `[media] private document bucket check failed (${status ?? 'unknown'})`,
        );
        return;
      }
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket }));
      console.log(`[media] created private document bucket ${Bucket}`);
    } catch (err) {
      console.warn(
        '[media] could not create private document bucket',
        err instanceof Error ? err.message : err,
      );
    }
  }

  async createUploadTarget(input: {
    bucket: StorageBucket;
    key: string;
    contentType: string;
    maxBytes: number;
    sessionId?: string;
  }): Promise<UploadTarget> {
    void input.maxBytes;
    void input.sessionId;
    const command = new PutObjectCommand({
      Bucket: bucketName(input.bucket),
      Key: input.key,
      ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 900,
    });
    return {
      method: 'PUT',
      uploadUrl,
      headers: { 'Content-Type': input.contentType },
    };
  }

  async putObject(input: {
    bucket: StorageBucket;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucketName(input.bucket),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getObjectBuffer(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: bucketName(input.bucket),
        Key: input.key,
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error('Empty object body');
    return Buffer.from(bytes);
  }

  async getObjectPrefix(input: {
    bucket: StorageBucket;
    key: string;
    byteLength: number;
  }): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: bucketName(input.bucket),
        Key: input.key,
        Range: `bytes=0-${Math.max(0, input.byteLength - 1)}`,
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error('Empty object body');
    return Buffer.from(bytes);
  }

  async finalizeUpload(input: {
    bucket: StorageBucket;
    sourceKey: string;
    destinationKey: string;
    sourceEtag?: string;
  }): Promise<void> {
    const bucket = bucketName(input.bucket);
    const encodedSourceKey = input.sourceKey
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/');
    await this.client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: input.destinationKey,
        CopySource: `/${bucket}/${encodedSourceKey}`,
        ...(input.sourceEtag ? { CopySourceIfMatch: input.sourceEtag } : {}),
      }),
    );

    // The client-visible presigned URL applies only to the staging source.
    // A failed cleanup is non-fatal: the completed asset already uses the
    // immutable destination key and lifecycle rules can clean leftovers.
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: input.sourceKey,
        }),
      );
    } catch {
      /* Best-effort staging cleanup. */
    }
  }

  async verifyObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<ObjectMetadata | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({
          Bucket: bucketName(input.bucket),
          Key: input.key,
        }),
      );
      return {
        byteSize: res.ContentLength ?? 0,
        contentType: res.ContentType,
        etag: res.ETag,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucketName(input.bucket),
        Key: input.key,
      }),
    );
  }

  async createDownloadUrl(input: {
    bucket: StorageBucket;
    key: string;
    accessLevel: MediaAccessLevel;
    expiresInSeconds?: number;
    transform?: MediaTransform;
  }): Promise<string | null> {
    // Never expose raw R2 keys through a public custom domain. Every delivery
    // URL must be minted by the API after its caller has checked publication,
    // visibility, moderation, and ownership rules. Signed URLs also keep the
    // bucket private and naturally expire if an asset is later unpublished.
    const command = new GetObjectCommand({
      Bucket: bucketName(input.bucket),
      Key: input.key,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds ?? 900,
    });
  }
}

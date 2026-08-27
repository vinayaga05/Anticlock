import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MediaAccessLevel, MediaTransform } from '@anticlock/contracts';
import type {
  ObjectMetadata,
  ObjectStorageProvider,
  StorageBucket,
  UploadTarget,
} from './ObjectStorageProvider.js';

function apiPublicBase(): string {
  return (
    process.env.API_PUBLIC_URL ??
    `http://localhost:${process.env.API_PORT ?? 4000}`
  );
}

export class LocalObjectStorageProvider implements ObjectStorageProvider {
  readonly name = 'local' as const;
  private root: string;

  constructor(rootDir = process.env.MEDIA_LOCAL_DIR ?? './.media') {
    this.root = path.resolve(rootDir);
  }

  private resolvePath(bucket: StorageBucket, key: string) {
    const full = path.resolve(this.root, bucket, key);
    if (!full.startsWith(path.resolve(this.root, bucket))) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async createUploadTarget(input: {
    bucket: StorageBucket;
    key: string;
    contentType: string;
    maxBytes: number;
    sessionId?: string;
  }): Promise<UploadTarget> {
    if (!input.sessionId) {
      throw new Error('Local uploads require sessionId');
    }
    // Client PUTs bytes to Hono; provider writes on that route via putObject.
    return {
      method: 'PUT',
      uploadUrl: `${apiPublicBase()}/admin/media/upload-sessions/${input.sessionId}/content`,
      headers: {
        'Content-Type': input.contentType,
      },
    };
  }

  async putObject(input: {
    bucket: StorageBucket;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const filePath = this.resolvePath(input.bucket, input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
  }

  async getObjectBuffer(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<Buffer> {
    return readFile(this.resolvePath(input.bucket, input.key));
  }

  async verifyObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<ObjectMetadata | null> {
    try {
      const filePath = this.resolvePath(input.bucket, input.key);
      const s = await stat(filePath);
      return { byteSize: s.size };
    } catch {
      return null;
    }
  }

  async deleteObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<void> {
    try {
      await unlink(this.resolvePath(input.bucket, input.key));
    } catch {
      /* ignore missing */
    }
  }

  async createDownloadUrl(input: {
    bucket: StorageBucket;
    key: string;
    accessLevel: MediaAccessLevel;
    expiresInSeconds?: number;
    transform?: MediaTransform;
  }): Promise<string | null> {
    void input.transform;
    void input.expiresInSeconds;
    // Served by GET /admin/media/files/... or /v1/media/public/...
    if (input.accessLevel === 'public') {
      return `${apiPublicBase()}/v1/media/file/${input.bucket}/${encodeURIComponent(input.key)}`;
    }
    return `${apiPublicBase()}/admin/media/file/${input.bucket}/${encodeURIComponent(input.key)}`;
  }
}

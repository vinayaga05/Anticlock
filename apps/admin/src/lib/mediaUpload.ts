import type {
  CompleteUploadResponse,
  CreateUploadSessionResponse,
  MediaAccessLevel,
  MediaKind,
} from '@anticlock/contracts';
import { apiFetch, apiPutBinary } from '@/lib/api';

export async function uploadMediaFile(input: {
  file: File;
  kind: MediaKind;
  accessLevel: MediaAccessLevel;
  entityHint?: string;
  onProgress?: (pct: number) => void;
}): Promise<CompleteUploadResponse> {
  input.onProgress?.(5);
  const session = await apiFetch<CreateUploadSessionResponse>(
    '/admin/media/upload-sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        kind: input.kind,
        accessLevel: input.accessLevel,
        filename: input.file.name,
        contentType: input.file.type || 'application/octet-stream',
        byteSize: input.file.size,
        entityHint: input.entityHint,
      }),
    },
  );
  input.onProgress?.(30);
  await apiPutBinary(session.uploadUrl, input.file, session.headers);
  input.onProgress?.(80);
  const result = await apiFetch<CompleteUploadResponse>(
    `/admin/media/upload-sessions/${session.sessionId}/complete`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  input.onProgress?.(100);
  return result;
}

export function formatBytes(n: number | null | undefined) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

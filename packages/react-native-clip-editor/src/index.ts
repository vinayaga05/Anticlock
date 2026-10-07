import NativeClipEditor from './specs/NativeClipEditor';

export type ClipVideoInfo = {
  durationMs: number;
  width: number;
  height: number;
  hasAudio: boolean;
};

export type ClipMusicMix = {
  /** file://, content://, absolute path, or http(s) (downloaded natively). */
  uri: string;
  /** Offset into the track where the clip's music starts. */
  startMs: number;
  /** 0..1 */
  volume: number;
};

export type ClipExportOptions = {
  /** One or more recorded segments / gallery files, concatenated in order. */
  sources: string[];
  /** Trim window on the concatenated timeline. */
  trimStartMs: number;
  trimEndMs: number;
  music?: ClipMusicMix | null;
  /** 0..1; 0 drops the original audio. */
  originalVolume: number;
  /** Longest output side in px (short side is capped at 1080). */
  maxLongSide?: number;
  /** Write a JPEG cover from the exported clip at this time. */
  coverAtMs?: number | null;
};

export type ClipExportResult = {
  uri: string;
  durationMs: number;
  width: number;
  height: number;
  byteSize: number;
  coverUri: string | null;
};

export class ClipEditorUnavailableError extends Error {
  constructor() {
    super(
      'The clip editor native module is not linked in this build. Run pod install / rebuild the app.',
    );
    this.name = 'ClipEditorUnavailableError';
  }
}

function native() {
  if (!NativeClipEditor) throw new ClipEditorUnavailableError();
  return NativeClipEditor;
}

export function isClipEditorAvailable() {
  return NativeClipEditor != null;
}

/** Native APIs accept URIs; VisionCamera returns plain filesystem paths. */
export function toMediaUri(pathOrUri: string) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUri)) return pathOrUri;
  return `file://${pathOrUri}`;
}

function num(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getVideoInfo(uri: string): Promise<ClipVideoInfo> {
  const raw = (await native().getInfo(toMediaUri(uri))) as Record<
    string,
    unknown
  >;
  return {
    durationMs: Math.round(num(raw.durationMs)),
    width: Math.round(num(raw.width)),
    height: Math.round(num(raw.height)),
    hasAudio: Boolean(raw.hasAudio),
  };
}

/** Evenly spaced frames across the concatenated sources (file:// JPEGs). */
export async function generateThumbnails(
  uris: string[],
  count: number,
  widthPx: number,
): Promise<string[]> {
  const raw = (await native().generateThumbnails(
    uris.map(toMediaUri),
    Math.max(1, Math.min(30, Math.round(count))),
    Math.max(16, Math.round(widthPx)),
  )) as { uris?: unknown };
  return Array.isArray(raw.uris)
    ? raw.uris.filter((u): u is string => typeof u === 'string')
    : [];
}

export function cancelExport() {
  NativeClipEditor?.cancelExport();
}

/**
 * Renders the edit to a single H.264/AAC MP4. Progress is polled from the
 * native exporter (0..1). Rejects with code `E_CANCELLED` after `cancelExport`.
 */
export async function exportClip(
  options: ClipExportOptions,
  onProgress?: (progress: number) => void,
): Promise<ClipExportResult> {
  const mod = native();
  const payload = JSON.stringify({
    ...options,
    sources: options.sources.map(toMediaUri),
    music: options.music
      ? { ...options.music, uri: toMediaUri(options.music.uri) }
      : null,
    maxLongSide: options.maxLongSide ?? 1920,
    coverAtMs: options.coverAtMs ?? null,
  });
  const timer = onProgress
    ? setInterval(() => {
        const value = num(mod.getExportProgress());
        onProgress(Math.max(0, Math.min(1, value)));
      }, 200)
    : null;
  try {
    const raw = (await mod.exportClip(payload)) as Record<string, unknown>;
    onProgress?.(1);
    return {
      uri: String(raw.uri),
      durationMs: Math.round(num(raw.durationMs)),
      width: Math.round(num(raw.width)),
      height: Math.round(num(raw.height)),
      byteSize: Math.round(num(raw.byteSize)),
      coverUri: typeof raw.coverUri === 'string' ? raw.coverUri : null,
    };
  } finally {
    if (timer) clearInterval(timer);
  }
}

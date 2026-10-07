/**
 * Pure model for the Reels editor: segments, trim window, music selection and
 * the edit metadata sent to `POST /v1/content/containers`. Kept free of React
 * Native imports so it can be unit tested in Jest.
 *
 * Mirrors `ClipEditMetadataSchema` in packages/contracts (mobile cannot import
 * @anticlock/contracts directly).
 */

export const MAX_CLIP_DURATION_MS = 90_000;
export const MIN_CLIP_DURATION_MS = 1_000;
export const MAX_CLIP_SEGMENTS = 20;
export const RECORD_LIMITS_S = [15, 30, 60, 90] as const;
export type RecordLimitSeconds = (typeof RECORD_LIMITS_S)[number];

/** One recorded take or one gallery video. */
export type ClipSource = {
  id: string;
  /** file:// or content:// URI readable by the native ClipEditor. */
  uri: string;
  durationMs: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
  origin: 'camera' | 'gallery';
};

export type MusicTrackSource = 'bundled' | 'remote';

/** A selectable music track (bundled with the app or from the API). */
export type MusicTrackOption = {
  id: string;
  title: string;
  artist: string | null;
  durationMs: number;
  source: MusicTrackSource;
  /** What react-native-video plays for preview (asset module or URL). */
  playback: string | number;
  /** What the native exporter reads (file, http(s), or Android raw name). */
  exportUri: string;
  license: string | null;
  attribution: string | null;
  /** Optional cover art (asset module or URL) shown in the music picker. */
  artwork?: string | number | null;
  /** Dev-only synthetic sample. Never shown in release builds. */
  isDevSample?: boolean;
};

export type SelectedMusic = {
  track: MusicTrackOption;
  startMs: number;
  volume: number;
};

export type ClipEditState = {
  sources: ClipSource[];
  /** Trim window over the concatenated sources timeline. */
  trimStartMs: number;
  trimEndMs: number;
  music: SelectedMusic | null;
  originalVolume: number;
  /** Cover frame time relative to the trimmed output. */
  coverAtMs: number;
};

export type ClipEditMetadata = {
  music: {
    trackId: string;
    source: MusicTrackSource;
    title: string;
    artist: string | null;
    startMs: number;
    volume: number;
  } | null;
  originalVolume: number;
  sourceTrimStartMs: number;
  sourceTrimEndMs: number;
  segmentCount: number;
};

const round = (value: number) => Math.round(value);
const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));
const clamp01 = (value: number) =>
  Number.isFinite(value) ? clamp(value, 0, 1) : 1;

export function totalDurationMs(sources: readonly ClipSource[]) {
  return sources.reduce(
    (sum, source) => sum + Math.max(0, source.durationMs || 0),
    0,
  );
}

/** Default edit for a new set of sources: keep the first 90 seconds. */
export function createEditState(sources: ClipSource[]): ClipEditState {
  const total = totalDurationMs(sources);
  return {
    sources,
    trimStartMs: 0,
    trimEndMs: Math.min(total, MAX_CLIP_DURATION_MS),
    music: null,
    originalVolume: 1,
    coverAtMs: 0,
  };
}

/**
 * Clamps a requested trim window to the timeline, the 90 s cap and the 1 s
 * minimum. `anchor` says which edge the user is dragging so the other edge
 * stays put where possible.
 */
export function clampTrim(
  totalMs: number,
  startMs: number,
  endMs: number,
  anchor: 'start' | 'end' = 'end',
): { trimStartMs: number; trimEndMs: number } {
  const total = Math.max(0, totalMs);
  const minLen = Math.min(MIN_CLIP_DURATION_MS, total);
  let start = clamp(startMs, 0, total);
  let end = clamp(endMs, 0, total);
  if (anchor === 'start') {
    start = clamp(start, Math.max(0, end - MAX_CLIP_DURATION_MS), end - minLen);
  } else {
    end = clamp(end, start + minLen, Math.min(total, start + MAX_CLIP_DURATION_MS));
  }
  start = clamp(start, 0, total);
  end = clamp(end, start, total);
  return { trimStartMs: round(start), trimEndMs: round(end) };
}

export function trimmedDurationMs(edit: Pick<ClipEditState, 'trimStartMs' | 'trimEndMs'>) {
  return Math.max(0, edit.trimEndMs - edit.trimStartMs);
}

/** Latest valid music start so the selection still covers the clip once. */
export function maxMusicStartMs(trackDurationMs: number, clipDurationMs: number) {
  return Math.max(0, round(trackDurationMs - clipDurationMs));
}

/** Maps a time on the concatenated timeline to (segment index, local time). */
export function locateInSources(sources: readonly ClipSource[], timeMs: number) {
  let remaining = Math.max(0, timeMs);
  for (let index = 0; index < sources.length; index++) {
    const duration = Math.max(0, sources[index].durationMs);
    if (remaining < duration || index === sources.length - 1) {
      return { index, localMs: Math.min(remaining, duration) };
    }
    remaining -= duration;
  }
  return { index: 0, localMs: 0 };
}

/** Start offset of each segment on the concatenated timeline. */
export function segmentOffsets(sources: readonly ClipSource[]) {
  const offsets: number[] = [];
  let at = 0;
  for (const source of sources) {
    offsets.push(at);
    at += Math.max(0, source.durationMs);
  }
  return offsets;
}

/** Sources that overlap the trim window (the ones that end up exported). */
export function usedSegmentCount(edit: ClipEditState) {
  const offsets = segmentOffsets(edit.sources);
  return edit.sources.filter((source, index) => {
    const start = offsets[index];
    const end = start + source.durationMs;
    return end > edit.trimStartMs + 0.5 && start < edit.trimEndMs - 0.5;
  }).length;
}

/** Edit metadata for the publish request (matches ClipEditMetadataSchema). */
export function buildEditMetadata(edit: ClipEditState): ClipEditMetadata {
  const segmentCount = clamp(usedSegmentCount(edit) || 1, 1, MAX_CLIP_SEGMENTS);
  return {
    music: edit.music
      ? {
          trackId: edit.music.track.id,
          source: edit.music.track.source,
          title: edit.music.track.title.slice(0, 160),
          artist: edit.music.track.artist?.slice(0, 160) ?? null,
          startMs: Math.max(0, round(edit.music.startMs)),
          volume: clamp01(edit.music.volume),
        }
      : null,
    originalVolume: clamp01(edit.originalVolume),
    sourceTrimStartMs: Math.max(0, round(edit.trimStartMs)),
    sourceTrimEndMs: Math.max(0, round(edit.trimEndMs)),
    segmentCount,
  };
}

/** Options for the native exporter (see @anticlock/react-native-clip-editor). */
export function buildExportOptions(edit: ClipEditState) {
  const length = trimmedDurationMs(edit);
  return {
    sources: edit.sources.map(source => source.uri),
    trimStartMs: round(edit.trimStartMs),
    trimEndMs: round(edit.trimEndMs),
    music: edit.music
      ? {
          uri: edit.music.track.exportUri,
          startMs: Math.max(0, round(edit.music.startMs)),
          volume: clamp01(edit.music.volume),
        }
      : null,
    originalVolume: clamp01(edit.originalVolume),
    coverAtMs: clamp(round(edit.coverAtMs), 0, Math.max(0, length - 1)),
  };
}

export function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Shorter "12.3s" style label for the trim window. */
export function formatSeconds(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(1)}s`;
}

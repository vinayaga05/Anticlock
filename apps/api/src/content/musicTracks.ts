import { and, asc, eq } from "drizzle-orm";
import {
  MAX_CLIP_DURATION_MS,
  type ClipEditMetadata,
  type ClipMusicAttribution,
  type MusicTrack,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import { musicTracks } from "../db/schema.js";
import { mediaService } from "../media/MediaService.js";

type MusicTrackRow = typeof musicTracks.$inferSelect;

/**
 * Exported clips are re-encoded on-device, so the container duration can land
 * a few frames past the cap. Allow a small tolerance before rejecting.
 */
export const CLIP_DURATION_TOLERANCE_MS = 500;

export function exceedsClipDuration(durationMs: number | null | undefined) {
  return (
    typeof durationMs === "number" &&
    durationMs > MAX_CLIP_DURATION_MS + CLIP_DURATION_TOLERANCE_MS
  );
}

/** Only absolute HTTPS URLs are returned to clients as a track source. */
export function safeAudioUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mapMusicTrackRow(
  row: Pick<
    MusicTrackRow,
    "id" | "title" | "artist" | "durationMs" | "license" | "attribution"
  >,
  url: string | null
): MusicTrack | null {
  if (!url || row.durationMs <= 0) return null;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist ?? null,
    durationMs: row.durationMs,
    url,
    license: row.license,
    attribution: row.attribution ?? null,
  };
}

/** Display attribution for a published Clip, derived from its edit metadata. */
export function musicAttributionFromEdit(
  edit: ClipEditMetadata | null | undefined
): ClipMusicAttribution | null {
  const music = edit?.music;
  if (!music) return null;
  return {
    trackId: music.trackId,
    source: music.source,
    title: music.title,
    artist: music.artist ?? null,
  };
}

/** Active, playable server-managed tracks. An empty list is a valid result. */
export async function listActiveMusicTracks(): Promise<MusicTrack[]> {
  const rows = await db
    .select()
    .from(musicTracks)
    .where(and(eq(musicTracks.isActive, true)))
    .orderBy(asc(musicTracks.sortOrder), asc(musicTracks.title))
    .limit(200);
  const tracks = await Promise.all(
    rows.map(async (row) => {
      const url = row.mediaId
        ? await mediaService.getPublicAudioDeliveryUrl(row.mediaId)
        : safeAudioUrl(row.audioUrl);
      return mapMusicTrackRow(row, url);
    })
  );
  return tracks.filter((track): track is MusicTrack => track !== null);
}

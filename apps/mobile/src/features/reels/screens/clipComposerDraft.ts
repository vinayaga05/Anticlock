import type { PostVisibility } from '@/shared/data/flash/types';
import {
  restoreSavedClipCover,
  restoreSavedClipVideo,
  type SavedClipCover,
  type SavedClipVideo,
} from '@/features/reels/media/clipMediaPicker';
import {
  createEditState,
  type ClipEditState,
  type ClipSource,
  type MusicTrackOption,
} from '@/features/reels/editor/clipEditModel';
import { bundledMusicTracks } from '@/features/reels/music/musicTracks';
import { getDevSampleTrack } from '@/features/reels/music/devSampleTrack';

export type CoverMode = 'generated' | 'custom';

type DraftDetails = {
  identityId: string | null;
  cover: SavedClipCover | null;
  coverMode: CoverMode;
  caption: string;
  hashtagsInput: string;
  taggedUserIdsInput: string;
  locationName: string;
  visibility: PostVisibility;
};

type ClipComposerDraftV1 = DraftDetails & {
  version: 1;
  video: SavedClipVideo | null;
};

type SavedMusic = {
  track: Omit<MusicTrackOption, 'playback'> & { playback: string | null };
  startMs: number;
  volume: number;
};

export type ClipComposerDraftV2 = DraftDetails & {
  version: 2;
  edit: {
    sources: ClipSource[];
    trimStartMs: number;
    trimEndMs: number;
    originalVolume: number;
    coverAtMs: number;
    music: SavedMusic | null;
  } | null;
};

export type RestoredDraft = Omit<DraftDetails, 'cover'> & {
  cover: ReturnType<typeof restoreSavedClipCover>;
  edit: ClipEditState | null;
};

function restoreTrack(saved: SavedMusic['track']): MusicTrackOption | null {
  if (saved.isDevSample) return getDevSampleTrack();
  if (saved.source === 'bundled') {
    // Asset module ids are build-specific, so resolve bundled tracks again.
    return bundledMusicTracks().find(track => track.id === saved.id) ?? null;
  }
  return saved.playback ? { ...saved, playback: saved.playback } : null;
}

export function serializeEdit(edit: ClipEditState | null): ClipComposerDraftV2['edit'] {
  if (!edit) return null;
  return {
    sources: edit.sources,
    trimStartMs: edit.trimStartMs,
    trimEndMs: edit.trimEndMs,
    originalVolume: edit.originalVolume,
    coverAtMs: edit.coverAtMs,
    music: edit.music
      ? {
          track: {
            ...edit.music.track,
            playback:
              typeof edit.music.track.playback === 'string'
                ? edit.music.track.playback
                : null,
          },
          startMs: edit.music.startMs,
          volume: edit.music.volume,
        }
      : null,
  };
}

/** Parses v1 (single picked video) and v2 (editor state) drafts. */
export function parseDraft(raw: string): RestoredDraft | null {
  const draft = JSON.parse(raw) as ClipComposerDraftV1 | ClipComposerDraftV2;
  if (!draft || (draft.version !== 1 && draft.version !== 2)) return null;
  const details = {
    identityId: draft.identityId,
    cover: restoreSavedClipCover(draft.cover),
    coverMode: draft.coverMode,
    caption: draft.caption,
    hashtagsInput: draft.hashtagsInput,
    taggedUserIdsInput: draft.taggedUserIdsInput,
    locationName: draft.locationName,
    visibility: draft.visibility,
  };
  if (draft.version === 1) {
    const video = restoreSavedClipVideo(draft.video);
    const edit = video?.localUri
      ? createEditState([
          {
            id: video.id,
            uri: video.localUri,
            durationMs: video.durationMs,
            width: video.width,
            height: video.height,
            origin: 'gallery',
          },
        ])
      : null;
    return { ...details, edit };
  }
  const saved = draft.edit;
  if (!saved || saved.sources.length === 0) return { ...details, edit: null };
  const track = saved.music ? restoreTrack(saved.music.track) : null;
  return {
    ...details,
    edit: {
      sources: saved.sources,
      trimStartMs: saved.trimStartMs,
      trimEndMs: saved.trimEndMs,
      originalVolume: saved.originalVolume,
      coverAtMs: saved.coverAtMs,
      music:
        saved.music && track
          ? { track, startMs: saved.music.startMs, volume: saved.music.volume }
          : null,
    },
  };
}

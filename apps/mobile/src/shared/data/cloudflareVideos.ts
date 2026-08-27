import type { ReelItem } from '@/shared/types';
import manifest from './cloudflare-videos.manifest.json';

export const R2_REELS_MANIFEST_URL =
  'https://pub-27960762dc094de6aef7fc922fec002a.r2.dev/reels-manifest.json';

/** Bundled Canva-export fallbacks until R2 / Stream URLs are live. */
const LOCAL_CANVA_ASSETS: Record<string, number> = {
  'yoga-flow.mp4': require('../assets/videos/canva/yoga-flow.mp4'),
  'fitness-reel.mp4': require('../assets/videos/canva/fitness-reel.mp4'),
  'health-tips.mp4': require('../assets/videos/canva/health-tips.mp4'),
};

export type CloudflareVideoEntry = {
  id: string;
  title: string;
  localFile?: string;
  objectKey?: string;
  streamUid?: string | null;
  playbackUrl?: string | null;
  thumbnailUrl?: string | null;
};

export type CloudflareVideoManifest = {
  remoteEnabled?: boolean;
  publicBaseUrl?: string;
  videos: CloudflareVideoEntry[];
};

export function getLocalManifest(): CloudflareVideoManifest {
  return manifest as CloudflareVideoManifest;
}

function publicBaseUrl(data: CloudflareVideoManifest) {
  return (
    data.publicBaseUrl?.replace(/\/$/, '') ??
    'https://pub-27960762dc094de6aef7fc922fec002a.r2.dev'
  );
}

function encodeObjectKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function resolveVideoPlaybackUrl(
  entry: CloudflareVideoEntry,
  data: CloudflareVideoManifest,
  preferRemote: boolean,
): string | number {
  if (preferRemote) {
    if (entry.playbackUrl) return entry.playbackUrl;
    if (entry.objectKey) {
      return `${publicBaseUrl(data)}/${encodeObjectKey(entry.objectKey)}`;
    }
  }

  const localFile = entry.localFile ?? entry.objectKey?.split('/').pop();
  if (localFile) {
    const local = LOCAL_CANVA_ASSETS[localFile];
    if (local != null) return local;
  }

  if (entry.playbackUrl) return entry.playbackUrl;
  return '';
}

/** Build Clips feed items from an R2 manifest (one reel per bucket video). */
export function buildClipsReelsFromManifest(
  data: CloudflareVideoManifest,
  templates: ReelItem[],
): ReelItem[] {
  const preferRemote = Boolean(data.remoteEnabled);
  const entries = data.videos ?? [];
  if (!entries.length) return templates;

  const template = templates[0] ?? {
    id: 'reel-template',
    title: 'Clip',
    author: 'anticlock',
    caption: '',
    videoUrl: '',
    posterUrl: '',
    likeCount: 0,
    commentCount: 0,
  };

  const remoteEntries = entries
    .map(entry => resolveVideoPlaybackUrl(entry, data, preferRemote))
    .filter(Boolean);

  if (preferRemote && !remoteEntries.length) {
    return templates;
  }

  return entries.map((entry, index) => {
    const meta = templates[index % templates.length] ?? template;
    const videoUrl = resolveVideoPlaybackUrl(entry, data, preferRemote);
    if (!videoUrl) return meta;

    return {
      ...meta,
      id: entry.id || `r2-reel-${index + 1}`,
      title: entry.title || meta.title,
      videoUrl,
      posterUrl: entry.thumbnailUrl ?? meta.posterUrl,
    };
  });
}

export async function fetchR2ReelsManifest(): Promise<CloudflareVideoManifest | null> {
  try {
    const res = await fetch(R2_REELS_MANIFEST_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as CloudflareVideoManifest;
    if (!data.remoteEnabled || !data.videos?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loadClipsReels(templates: ReelItem[]): Promise<ReelItem[]> {
  const remote = await fetchR2ReelsManifest();
  if (remote) return buildClipsReelsFromManifest(remote, templates);

  const local = getLocalManifest();
  if (local.remoteEnabled && local.videos.length) {
    return buildClipsReelsFromManifest(local, templates);
  }

  return buildClipsReelsFromManifest(
    { ...local, remoteEnabled: false },
    templates,
  );
}

/** @deprecated Use buildClipsReelsFromManifest */
export function applyCloudflareVideosToReels(reels: ReelItem[]): ReelItem[] {
  return buildClipsReelsFromManifest(getLocalManifest(), reels);
}

export function getFlashCloudflareVideo(): {
  url: string | number;
  posterUrl?: string;
} | null {
  const data = getLocalManifest();
  const entry = data.videos[0];
  if (!entry) return null;

  const url = resolveVideoPlaybackUrl(entry, data, Boolean(data.remoteEnabled));
  if (!url) return null;

  return {
    url,
    posterUrl: entry.thumbnailUrl ?? undefined,
  };
}

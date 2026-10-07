import { useQuery } from '@tanstack/react-query';
import { Image, Platform } from 'react-native';
import { apiRequest } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import type { MusicTrackOption } from '@/features/reels/editor/clipEditModel';
import { BUNDLED_MUSIC_TRACKS } from './bundledTracks';
import { getDevSampleTrack } from './devSampleTrack';

/** Shape of `GET /v1/content/music-tracks` (ListMusicTracksResponseSchema). */
export type ApiMusicTrack = {
  id: string;
  title: string;
  artist: string | null;
  durationMs: number;
  url: string;
  license: string;
  attribution: string | null;
};

/** Metro serves assets on the host; the Android emulator reaches it via 10.0.2.2. */
function rewriteMetroHost(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '://10.0.2.2$2');
}

/** react-native-video source for a track (asset modules resolve to a URI). */
export function musicPlaybackSource(playback: string | number): { uri: string } {
  if (typeof playback === 'number') {
    return { uri: rewriteMetroHost(Image.resolveAssetSource(playback)?.uri ?? '') };
  }
  return { uri: playback };
}

export function bundledMusicTracks(): MusicTrackOption[] {
  return BUNDLED_MUSIC_TRACKS.map(track => {
    const resolved = Image.resolveAssetSource(track.asset);
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      durationMs: track.durationMs,
      source: 'bundled' as const,
      playback: track.asset,
      exportUri: rewriteMetroHost(resolved?.uri ?? ''),
      license: track.license,
      attribution: track.attribution,
    };
  }).filter(track => track.exportUri.length > 0);
}

export function remoteMusicTrackOption(track: ApiMusicTrack): MusicTrackOption | null {
  if (!/^https:\/\//i.test(track.url)) return null;
  if (!Number.isFinite(track.durationMs) || track.durationMs <= 0) return null;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    durationMs: track.durationMs,
    source: 'remote',
    playback: track.url,
    exportUri: track.url,
    license: track.license,
    attribution: track.attribution,
  };
}

async function fetchRemoteTracks(): Promise<MusicTrackOption[]> {
  if (!isApiEnabled) return [];
  const response = await apiRequest<{ tracks: ApiMusicTrack[] }>(
    '/v1/content/music-tracks',
  );
  return (response.tracks ?? [])
    .map(remoteMusicTrackOption)
    .filter((track): track is MusicTrackOption => track !== null);
}

export type MusicLibrary = {
  tracks: MusicTrackOption[];
  /** True when the remote catalogue failed to load (bundled tracks still shown). */
  remoteFailed: boolean;
};

/**
 * Bundled tracks plus the licensed catalogue from the API. Either list can be
 * empty. The picker shows an empty state when both are.
 */
export function useMusicLibraryQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['content', 'music-tracks', isApiEnabled ? 'api' : 'local'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MusicLibrary> => {
      const local = bundledMusicTracks();
      const dev = getDevSampleTrack();
      let remote: MusicTrackOption[] = [];
      let remoteFailed = false;
      try {
        remote = await fetchRemoteTracks();
      } catch {
        remoteFailed = true;
      }
      const seen = new Set<string>();
      const tracks = [...local, ...remote, ...(dev ? [dev] : [])].filter(track => {
        const key = `${track.source}:${track.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { tracks, remoteFailed };
    },
  });
}

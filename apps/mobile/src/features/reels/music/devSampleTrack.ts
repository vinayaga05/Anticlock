import { NativeModules } from 'react-native';
import type { MusicTrackOption } from '@/features/reels/editor/clipEditModel';

/**
 * DEV SAMPLE ONLY. A synthetic tone (no third-party audio) for testing the
 * music picker, preview and export in development builds.
 *
 * The file lives at apps/mobile/dev-assets/music/dev-sample-tone.m4a. The Metro
 * dev server serves it at /dev-music/... (see metro.config.js). It is never
 * `require`d, so it is never packaged into a release bundle, and this
 * function returns null when `__DEV__` is false.
 */
export const DEV_SAMPLE_TRACK_ID = 'dev-sample-tone';
const DEV_SAMPLE_DURATION_MS = 30_000;

function devServerOrigin(): string | null {
  const sourceCode = NativeModules.SourceCode as
    | { scriptURL?: string; getConstants?: () => { scriptURL?: string } }
    | undefined;
  const scriptURL =
    sourceCode?.scriptURL ?? sourceCode?.getConstants?.().scriptURL ?? '';
  const match = /^(https?:\/\/[^/]+)\//i.exec(scriptURL);
  return match ? match[1] : null;
}

export function getDevSampleTrack(): MusicTrackOption | null {
  if (!__DEV__) return null;
  const origin = devServerOrigin();
  if (!origin) return null;
  const url = `${origin}/dev-music/dev-sample-tone.m4a`;
  return {
    id: DEV_SAMPLE_TRACK_ID,
    title: 'DEV SAMPLE · Synthetic tone',
    artist: 'Generated test signal',
    durationMs: DEV_SAMPLE_DURATION_MS,
    source: 'bundled',
    playback: url,
    exportUri: url,
    license: 'Generated test tone, dev builds only',
    attribution: null,
    isDevSample: true,
  };
}

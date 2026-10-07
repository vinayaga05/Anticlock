/**
 * Music bundled inside the app binary.
 *
 * This list is intentionally EMPTY. Only add audio that Anticlock has a
 * written licence to redistribute inside the app (royalty-free with
 * redistribution rights, commissioned, or owned). Never add commercial or
 * copyrighted songs. See README.md in this folder for the steps.
 *
 * Example entry:
 *
 *   {
 *     id: 'bundled-morning-run',            // stable, never reuse an id
 *     title: 'Morning Run',
 *     artist: 'Anticlock Studio',
 *     durationMs: 62_000,
 *     asset: require('./bundled/morning-run.m4a'),
 *     license: 'Owned by Anticlock',
 *     attribution: null,
 *   },
 */
export type BundledMusicTrack = {
  id: string;
  title: string;
  artist: string | null;
  durationMs: number;
  /** `require('./bundled/<file>.m4a')`. */
  asset: number;
  license: string;
  attribution: string | null;
};

export const BUNDLED_MUSIC_TRACKS: BundledMusicTrack[] = [];

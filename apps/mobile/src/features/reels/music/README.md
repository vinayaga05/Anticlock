# Reels music

The editor's music picker combines two sources:

1. **Bundled tracks**: `bundledTracks.ts` (empty by default). These ship in
   the app binary and work offline.
2. **Remote catalogue**: `GET /v1/content/music-tracks` (auth required),
   backed by the `music_tracks` table. Only rows with `is_active = true` and an
   `https` URL are returned.

If both are empty, the picker shows an empty state and the clip keeps its
original audio. **Do not add copyrighted or commercial music.** Every track
needs a licence that lets Anticlock redistribute it and let users sync it to
their videos. Store the licence text and any required attribution with the
track.

## Adding a bundled track

1. Put the file in `apps/mobile/src/features/reels/music/bundled/`. Use AAC
   `.m4a`, 44.1/48 kHz, stereo, about 128–192 kbps, and keep it under about
   2 MB. Lowercase file names only (Android resource rules).
2. Add an entry to `BUNDLED_MUSIC_TRACKS` in `bundledTracks.ts` with a stable
   `id`, a `durationMs` that matches the file, `asset: require('./bundled/<file>.m4a')`,
   the `license`, and any `attribution`.
3. Rebuild the app. Metro packages the file automatically.

## Adding a remote track (no app release needed)

1. Upload the audio to the public media bucket or CDN (it must be served over
   HTTPS, with no auth).
2. Insert a row (the API runs the additive migration in `apps/api/src/db/migrate.ts`):

   ```sql
   INSERT INTO music_tracks (title, artist, duration_ms, audio_url, license, attribution, is_active)
   VALUES ('Morning Run', 'Anticlock Studio', 62000,
           'https://media.example.com/music/morning-run.m4a',
           'Owned by Anticlock', NULL, true);
   ```

   Rows are inactive by default (`is_active = false`), so nothing shows up by
   accident.

## Dev sample

Development builds also list **"DEV SAMPLE · Synthetic tone"**, a generated
sine/beat test signal (`apps/mobile/dev-assets/music/dev-sample-tone.m4a`,
made by `apps/mobile/scripts/generate-dev-music-sample.py`). The Metro dev
server serves it (`/dev-music/*` in `metro.config.js`). It is never
`require`d, so it is **not** part of release bundles, and `getDevSampleTrack()`
returns `null` when `__DEV__` is false.

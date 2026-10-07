import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";
import {
  ClipEditMetadataSchema,
  ContentFeedItemSchema,
  CreateContentContainerRequestSchema,
  ListMusicTracksResponseSchema,
  MAX_CLIP_DURATION_MS,
} from "@anticlock/contracts";
import {
  exceedsClipDuration,
  mapMusicTrackRow,
  musicAttributionFromEdit,
  safeAudioUrl,
} from "../content/musicTracks.js";
import { contentMobileRoutes } from "./content.js";
import type { AppEnv } from "../middleware/auth.js";

const VIDEO_ID = "00000001-0000-4000-8000-000000000001";

const validEdit = {
  music: {
    trackId: "dev-sine-pulse",
    source: "bundled" as const,
    title: "Dev sample – sine pulse",
    artist: null,
    startMs: 4_000,
    volume: 0.8,
  },
  originalVolume: 0.3,
  sourceTrimStartMs: 1_500,
  sourceTrimEndMs: 16_500,
  segmentCount: 2,
};

describe("Clip edit metadata contract", () => {
  it("accepts a trimmed clip with music", () => {
    assert.equal(ClipEditMetadataSchema.safeParse(validEdit).success, true);
  });

  it("accepts a clip that keeps only original audio", () => {
    const parsed = ClipEditMetadataSchema.safeParse({
      ...validEdit,
      music: null,
      originalVolume: 1,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects trims longer than 90 seconds or shorter than 1 second", () => {
    assert.equal(
      ClipEditMetadataSchema.safeParse({
        ...validEdit,
        sourceTrimStartMs: 0,
        sourceTrimEndMs: MAX_CLIP_DURATION_MS + 1,
      }).success,
      false
    );
    assert.equal(
      ClipEditMetadataSchema.safeParse({
        ...validEdit,
        sourceTrimStartMs: 1_000,
        sourceTrimEndMs: 1_500,
      }).success,
      false
    );
  });

  it("rejects out-of-range volumes and unknown keys", () => {
    assert.equal(
      ClipEditMetadataSchema.safeParse({ ...validEdit, originalVolume: 1.5 })
        .success,
      false
    );
    assert.equal(
      ClipEditMetadataSchema.safeParse({ ...validEdit, speed: 2 }).success,
      false
    );
  });

  it("is optional on containers and only allowed for clips", () => {
    const base = {
      format: "clip",
      mediaType: "video",
      caption: "",
      mediaIds: [VIDEO_ID],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(base).success, true);
    assert.equal(
      CreateContentContainerRequestSchema.safeParse({ ...base, edit: validEdit })
        .success,
      true
    );
    assert.equal(
      CreateContentContainerRequestSchema.safeParse({
        ...base,
        format: "flash",
        edit: validEdit,
      }).success,
      false
    );
  });
});

describe("Clip music helpers", () => {
  it("derives feed attribution from edit metadata", () => {
    assert.deepEqual(musicAttributionFromEdit(validEdit), {
      trackId: "dev-sine-pulse",
      source: "bundled",
      title: "Dev sample – sine pulse",
      artist: null,
    });
    assert.equal(musicAttributionFromEdit(null), null);
    assert.equal(
      musicAttributionFromEdit({ ...validEdit, music: null }),
      null
    );
  });

  it("allows a small export tolerance over the 90 second cap", () => {
    assert.equal(exceedsClipDuration(MAX_CLIP_DURATION_MS), false);
    assert.equal(exceedsClipDuration(MAX_CLIP_DURATION_MS + 400), false);
    assert.equal(exceedsClipDuration(MAX_CLIP_DURATION_MS + 1_000), true);
    assert.equal(exceedsClipDuration(null), false);
  });

  it("only exposes HTTPS track URLs", () => {
    assert.equal(safeAudioUrl("http://example.com/a.m4a"), null);
    assert.equal(safeAudioUrl("javascript:alert(1)"), null);
    assert.equal(safeAudioUrl("not a url"), null);
    assert.equal(
      safeAudioUrl("https://media.example.com/music/a.m4a"),
      "https://media.example.com/music/a.m4a"
    );
  });

  it("maps playable rows to the public track contract", () => {
    const row = {
      id: "00000009-0000-4000-8000-000000000009",
      title: "House track",
      artist: "Anticlock",
      durationMs: 30_000,
      license: "Owned by Anticlock",
      attribution: null,
    };
    assert.equal(mapMusicTrackRow(row, null), null);
    const track = mapMusicTrackRow(row, "https://media.example.com/a.m4a");
    assert.ok(track);
    assert.equal(
      ListMusicTracksResponseSchema.safeParse({ tracks: [track] }).success,
      true
    );
  });

  it("keeps feed items without music valid", () => {
    const shape = ContentFeedItemSchema.shape;
    assert.ok("music" in shape);
    assert.equal(shape.music.safeParse(undefined).success, true);
    assert.equal(shape.music.safeParse(null).success, true);
  });
});

describe("GET /v1/content/music-tracks", () => {
  it("requires authentication", async () => {
    const app = new Hono<AppEnv>();
    app.route("/v1/content", contentMobileRoutes);
    const res = await app.request("/v1/content/music-tracks");
    assert.equal(res.status, 401);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ContentFeedItemSchema } from "@anticlock/contracts";
import {
  calculateClipTrendingScore,
  CONTENT_CLIP_VIEW_WINDOW_MS,
  contentClipViewWindowStart,
} from "./content.js";

describe("Clip feed ranking", () => {
  it("prioritizes fresh engagement over stale cumulative popularity", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const freshTrending = calculateClipTrendingScore(
      {
        viewCount: 500,
        likeCount: 30,
        commentCount: 6,
        shareCount: 5,
        publishedAt: new Date("2026-09-07T09:00:00.000Z"),
      },
      now
    );
    const stalePopular = calculateClipTrendingScore(
      {
        viewCount: 5_000,
        likeCount: 400,
        commentCount: 50,
        shareCount: 25,
        publishedAt: new Date("2026-08-08T10:00:00.000Z"),
      },
      now
    );

    assert.ok(freshTrending > stalePopular);
  });

  it("is deterministic for the same post and ranking time", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const post = {
      viewCount: 1_200,
      likeCount: 90,
      commentCount: 12,
      shareCount: 8,
      publishedAt: new Date("2026-09-07T08:00:00.000Z"),
    };

    assert.equal(
      calculateClipTrendingScore(post, now),
      calculateClipTrendingScore(post, now)
    );
  });

  it("uses the public tag field and includes the current viewer like state", () => {
    const item = {
      id: "1167f8ad-e04f-4709-bd43-91d8179e1151",
      format: "clip" as const,
      mediaType: "video" as const,
      status: "published" as const,
      caption: "A Clip",
      mediaIds: ["8f1c7988-fa13-4812-92f0-e5e7187b0570"],
      thumbnailMediaId: null,
      hashtags: ["anticlock"],
      taggedUserIds: ["9b9e19af-b4d7-46f6-91f0-93c0f57220d3"],
      location: null,
      visibility: "public",
      author: {
        type: "user" as const,
        id: "e99c0446-2f34-4d05-8c34-c6d065291d26",
        name: "Clip creator",
        avatarUrl: null,
      },
      createdAt: "2026-09-07T10:00:00.000Z",
      publishedAt: "2026-09-07T10:00:00.000Z",
      expiresAt: null,
      playbackUrl: "https://media.example.test/clips/one.mp4",
      posterUrl: null,
      duplicateClusterId: "sha256:one",
      trendingScore: 12.345,
      viewerHasLiked: true,
    };

    assert.equal(ContentFeedItemSchema.safeParse(item).success, true);
    assert.equal(
      ContentFeedItemSchema.safeParse({
        ...item,
        taggedUserIds: undefined,
        taggedMobileUserIds: item.taggedUserIds,
      }).success,
      false
    );
  });

  it("uses a one-day window for unique viewer counts", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const start = contentClipViewWindowStart(now);

    assert.equal(now.getTime() - start.getTime(), CONTENT_CLIP_VIEW_WINDOW_MS);
    assert.equal(start.toISOString(), "2026-09-06T10:00:00.000Z");
  });
});

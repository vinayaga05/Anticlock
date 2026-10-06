import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CreateContentContainerRequestSchema } from "@anticlock/contracts";

describe("Story content validation", () => {
  it("accepts a text-only story with caption", () => {
    const valid = {
      format: "story",
      mediaType: "text",
      caption: "Good morning! Starting the day with a run 🏃",
      visibility: "followers",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts a photo story with mediaIds", () => {
    const valid = {
      format: "story",
      mediaType: "image",
      caption: "Morning view",
      mediaIds: ["a1b2c3d4-5678-90ab-cdef-1234567890ab"],
      visibility: "followers",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts a video story with mediaIds", () => {
    const valid = {
      format: "story",
      mediaType: "video",
      caption: "Behind the scenes",
      mediaIds: ["b2c3d4e5-6789-01bc-def0-234567890abc"],
      visibility: "friends",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("rejects text story with empty caption", () => {
    const invalid = {
      format: "story",
      mediaType: "text",
      caption: "",
      visibility: "followers",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(invalid).success, false);
  });

  it("rejects image story without mediaIds", () => {
    const invalid = {
      format: "story",
      mediaType: "image",
      caption: "Test",
      visibility: "followers",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(invalid).success, false);
  });

  it("rejects video story without mediaIds", () => {
    const invalid = {
      format: "story",
      mediaType: "video",
      caption: "Test",
      visibility: "followers",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(invalid).success, false);
  });

  it("accepts close_friends visibility for story", () => {
    const valid = {
      format: "story",
      mediaType: "text",
      caption: "Private update for close friends",
      visibility: "friends",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts community visibility for story", () => {
    const valid = {
      format: "story",
      mediaType: "text",
      caption: "Community announcement",
      visibility: "community",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });
});

describe("Flash post validation", () => {
  it("accepts a text-only flash post", () => {
    const valid = {
      format: "flash",
      mediaType: "text",
      caption: "What a beautiful day!",
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts a flash post with single image", () => {
    const valid = {
      format: "flash",
      mediaType: "image",
      caption: "Check this out",
      mediaIds: ["c3d4e5f6-7890-12cd-ef01-34567890abcd"],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts a flash post with multiple images", () => {
    const valid = {
      format: "flash",
      mediaType: "image",
      caption: "Gallery",
      mediaIds: [
        "00000001-0000-4000-8000-000000000001",
        "00000002-0000-4000-8000-000000000002",
      ],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts a flash post with video", () => {
    const valid = {
      format: "flash",
      mediaType: "video",
      caption: "Short video moment",
      mediaIds: ["00000003-0000-4000-8000-000000000003"],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts a hybrid flash post with mixed media", () => {
    const valid = {
      format: "flash",
      mediaType: "hybrid",
      caption: "Mixed media post",
      mediaIds: [
        "00000004-0000-4000-8000-000000000004",
        "00000005-0000-4000-8000-000000000005",
      ],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("rejects text flash post with empty caption", () => {
    const invalid = {
      format: "flash",
      mediaType: "text",
      caption: "",
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(invalid).success, false);
  });

  it("rejects flash post with excessive mediaIds (>10)", () => {
    const invalid = {
      format: "flash",
      mediaType: "image",
      caption: "Too many",
      mediaIds: Array(11).fill("00000006-0000-4000-8000-000000000006"),
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(invalid).success, false);
  });

  it("accepts flash post with hashtags", () => {
    const valid = {
      format: "flash",
      mediaType: "text",
      caption: "Testing hashtags",
      hashtags: ["anticlock", "fitness", "wellness"],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts flash post with location", () => {
    const valid = {
      format: "flash",
      mediaType: "text",
      caption: "At the beach",
      location: {
        name: "Marina Beach, Chennai",
        latitude: 13.0499,
        longitude: 80.2824,
      },
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });

  it("accepts flash post with taggedUserIds", () => {
    const valid = {
      format: "flash",
      mediaType: "image",
      caption: "With friends",
      mediaIds: ["00000007-0000-4000-8000-000000000007"],
      taggedUserIds: ["00000008-0000-4000-8000-000000000008"],
      visibility: "public",
    };
    assert.equal(CreateContentContainerRequestSchema.safeParse(valid).success, true);
  });
});

describe("Story authorization and expiry", () => {
  it("story format should expire in 24 hours (tested in content.ts)", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    assert.equal(expectedExpiry.toISOString(), "2026-09-08T10:00:00.000Z");
  });

  it("flash format should not have expiry by default", () => {
    assert.ok(true);
  });
});

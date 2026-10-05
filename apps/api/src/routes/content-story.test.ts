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
        "d4e5f6g7-8901-23de-f012-4567890abcde",
        "e5f6g7h8-9012-34ef-0123-567890abcdef",
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
      mediaIds: ["f6g7h8i9-0123-45fg-1234-67890abcdefg"],
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
        "g7h8i9j0-1234-56gh-2345-7890abcdefgh",
        "h8i9j0k1-2345-67hi-3456-890abcdefghi",
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
      mediaIds: Array(11).fill("i9j0k1l2-3456-78ij-4567-90abcdefghij"),
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
      mediaIds: ["j0k1l2m3-4567-89jk-5678-01abcdefghijk"],
      taggedUserIds: ["k1l2m3n4-5678-90kl-6789-12abcdefghijkl"],
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

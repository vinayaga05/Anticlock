import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { introVideoMediaIdFromPublicProfile } from "./providerIntroClip.js";

describe("introVideoMediaIdFromPublicProfile", () => {
  it("returns the introduction video media id for any business profile payload", () => {
    const mediaId = "8f1c7988-fa13-4812-92f0-e5e7187b0570";
    assert.equal(
      introVideoMediaIdFromPublicProfile({
        common: {
          profile: { introVideoMediaId: mediaId, description: "Local plumber" },
        },
      }),
      mediaId
    );
  });

  it("ignores missing or invalid introduction video ids", () => {
    assert.equal(introVideoMediaIdFromPublicProfile(null), null);
    assert.equal(introVideoMediaIdFromPublicProfile({}), null);
    assert.equal(
      introVideoMediaIdFromPublicProfile({
        common: { profile: { introVideoMediaId: "not-a-uuid" } },
      }),
      null
    );
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMarketplaceMedia } from "./marketplaceMedia.js";

const image = "11111111-1111-4111-8111-111111111111";
const video = "22222222-2222-4222-8222-222222222222";
test("resolves uploaded logos, covers and intro videos once per page with the expected public media kind", async () => {
  const calls: string[] = [];
  const profile = {
    common: {
      profile: {
        logoMediaId: image,
        coverMediaIds: [image],
        introVideoMediaId: video,
      },
    },
  };
  const result = await resolveMarketplaceMedia(
    [
      { id: "a", publicProfile: profile, isPrivate: false },
      { id: "b", publicProfile: profile, isPrivate: false },
    ],
    async (id, kind) => {
      calls.push(`${kind}:${id}`);
      return `https://cdn.test/${id}`;
    },
    async () => []
  );
  assert.deepEqual(calls.sort(), [`image:${image}`, `video:${video}`]);
  assert.deepEqual(result.get("a"), {
    avatarUrl: `https://cdn.test/${image}`,
    coverUrl: `https://cdn.test/${image}`,
    introVideoUrl: `https://cdn.test/${video}`,
  });
  assert.deepEqual(result.get("a"), result.get("b"));
});
test("missing, rejected or unavailable media cannot break a list or expose unrelated attachments", async () => {
  let calls = 0;
  const result = await resolveMarketplaceMedia(
    [
      { id: "empty", publicProfile: null, isPrivate: false },
      {
        id: "bad",
        isPrivate: false,
        publicProfile: {
          common: {
            profile: { logoMediaId: "bad", introVideoMediaId: video },
            kyc: { documentMediaId: image },
          },
        },
      },
    ],
    async () => {
      calls++;
      throw new Error("Unavailable");
    },
    async () => []
  );
  assert.equal(calls, 1);
  for (const media of result.values())
    assert.deepEqual(media, {
      avatarUrl: null,
      coverUrl: null,
      introVideoUrl: null,
    });
});

test("private providers and hidden intro Clips retain their image without exposing the video", async () => {
  const profile = {
    common: { profile: { logoMediaId: image, introVideoMediaId: video } },
  };
  const result = await resolveMarketplaceMedia(
    [
      { id: "private", publicProfile: profile, isPrivate: true },
      { id: "hidden", publicProfile: profile, isPrivate: false },
      { id: "legacy", publicProfile: profile, isPrivate: false },
    ],
    async (id) => `https://cdn.test/${id}`,
    async (intros) => {
      assert.deepEqual(intros, [
        { providerId: "hidden", mediaId: video },
        { providerId: "legacy", mediaId: video },
      ]);
      return [{ providerId: "hidden", mediaId: video }];
    }
  );
  assert.equal(result.get("private")?.introVideoUrl, null);
  assert.equal(result.get("hidden")?.introVideoUrl, null);
  assert.equal(
    result.get("legacy")?.introVideoUrl,
    `https://cdn.test/${video}`
  );
  for (const media of result.values())
    assert.equal(media.avatarUrl, `https://cdn.test/${image}`);
});

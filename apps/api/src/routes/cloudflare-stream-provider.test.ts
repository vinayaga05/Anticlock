import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { CloudflareStreamVideoProvider } from "../media/CloudflareStreamVideoProvider.js";

describe("Cloudflare Stream content provider", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    accountId: process.env.STREAM_ACCOUNT_ID,
    apiToken: process.env.STREAM_API_TOKEN,
    subdomain: process.env.STREAM_CUSTOMER_SUBDOMAIN,
  };
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  before(() => {
    process.env.STREAM_ACCOUNT_ID = "account-test";
    process.env.STREAM_API_TOKEN = "secret-test-token";
    process.env.STREAM_CUSTOMER_SUBDOMAIN = "video.example.test";
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      const result = url.endsWith("/direct_upload")
        ? { uploadURL: "https://upload.example.test/once", uid: "stream-uid" }
        : { token: "signed-playback-token" };
      return new Response(
        JSON.stringify({ success: true, errors: [], result }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    process.env.STREAM_ACCOUNT_ID = originalEnv.accountId;
    process.env.STREAM_API_TOKEN = originalEnv.apiToken;
    process.env.STREAM_CUSTOMER_SUBDOMAIN = originalEnv.subdomain;
  });

  it("creates private multipart direct uploads for restricted Clips", async () => {
    const provider = new CloudflareStreamVideoProvider();
    const session = await provider.createUploadSession({
      requireSignedUrls: true,
      maxDurationSeconds: 90,
      meta: { mediaAssetId: "asset-1" },
    });

    assert.deepEqual(session, {
      uploadUrl: "https://upload.example.test/once",
      externalId: "stream-uid",
      method: "POST",
      fieldName: "file",
    });
    const body = JSON.parse(String(requests.at(-1)?.init?.body));
    assert.equal(body.requireSignedURLs, true);
    assert.equal(body.maxDurationSeconds, 90);
  });

  it("uses the signed token, never the private UID, in a restricted manifest", async () => {
    const provider = new CloudflareStreamVideoProvider();
    const playback = await provider.getPlayback("private-stream-uid", true);

    assert.equal(
      playback.playbackUrl,
      "https://video.example.test/signed-playback-token/manifest/video.m3u8",
    );
    assert.ok(playback.expiresAt);
    assert.match(requests.at(-1)?.url ?? "", /private-stream-uid\/token$/);
  });
});

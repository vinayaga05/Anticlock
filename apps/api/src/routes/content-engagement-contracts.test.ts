import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RecordContentClipPlaybackEventRequestSchema,
  RecordContentClipViewRequestSchema,
  SetContentClipLikeRequestSchema,
} from "@anticlock/contracts";

describe("content Clip engagement contracts", () => {
  it("requires an idempotency key and meaningful watch duration", () => {
    const eventId = "c20bc6aa-309f-4cc1-ae56-8d720c8f6f1d";
    assert.equal(
      RecordContentClipViewRequestSchema.safeParse({
        eventId,
        watchedMs: 1_000,
      }).success,
      true
    );
    assert.equal(
      RecordContentClipViewRequestSchema.safeParse({
        eventId,
        watchedMs: 999,
      }).success,
      false
    );
  });

  it("uses an idempotent set-state like request", () => {
    assert.equal(
      SetContentClipLikeRequestSchema.safeParse({ liked: true }).success,
      true
    );
    assert.equal(
      SetContentClipLikeRequestSchema.safeParse({ liked: "true" }).success,
      false
    );
  });

  it("accepts bounded, URL-free playback quality telemetry", () => {
    const eventId = "c20bc6aa-309f-4cc1-ae56-8d720c8f6f1d";
    assert.equal(
      RecordContentClipPlaybackEventRequestSchema.safeParse({
        eventId,
        eventType: "first_frame",
        valueMs: 320,
        sourceType: "hls",
        networkType: "cellular",
        preloaded: true,
      }).success,
      true
    );
    assert.equal(
      RecordContentClipPlaybackEventRequestSchema.safeParse({
        eventId,
        eventType: "first_frame",
        valueMs: 320,
        sourceType: "hls",
        signedUrl: "https://secret.example/token",
      }).success,
      false
    );
  });
});

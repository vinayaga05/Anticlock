import { z } from "zod";

export const ProviderMembershipRoleSchema = z.enum([
  "owner",
  "admin",
  "content_creator",
  "analyst",
]);
export type ProviderMembershipRole = z.infer<
  typeof ProviderMembershipRoleSchema
>;

export const PublishingActorTypeSchema = z.enum(["user", "provider"]);
export type PublishingActorType = z.infer<typeof PublishingActorTypeSchema>;

export const ContentFormatSchema = z.enum(["flash", "story", "clip"]);
export type ContentFormat = z.infer<typeof ContentFormatSchema>;

export const ContentMediaTypeSchema = z.enum([
  "text",
  "image",
  "video",
  "hybrid",
]);
export type ContentMediaType = z.infer<typeof ContentMediaTypeSchema>;

/**
 * Store normalized hashtag values (without `#`) so searching and ranking do
 * not need to normalize every row at read time. Display clients add `#`.
 */
export const ContentHashtagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_]{0,49}$/, "Use letters, numbers, and underscores");
export type ContentHashtag = z.infer<typeof ContentHashtagSchema>;

/** A human-readable place is sufficient; coordinates are optional and bounded. */
export const ContentLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude and longitude must be supplied together",
      });
    }
  });
export type ContentLocation = z.infer<typeof ContentLocationSchema>;

export const PublishingIdentitySchema = z.object({
  type: PublishingActorTypeSchema,
  id: z.string().uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: ProviderMembershipRoleSchema.optional(),
});
export type PublishingIdentity = z.infer<typeof PublishingIdentitySchema>;

/**
 * Mobile Clips are capped at 90 seconds after on-device editing. Admin/CMS
 * reels keep their separate 3-minute limit (`MAX_REEL_VIDEO_DURATION_MS`).
 */
export const MAX_CLIP_DURATION_MS = 90_000;
export const MIN_CLIP_DURATION_MS = 1_000;

/** Where a selected music track came from. No third-party catalogue is implied. */
export const ClipMusicSourceSchema = z.enum(["bundled", "remote"]);
export type ClipMusicSource = z.infer<typeof ClipMusicSourceSchema>;

/**
 * The music a creator mixed into a Clip on-device. The audio is already baked
 * into the uploaded MP4; this record exists for attribution and the feed label.
 */
export const ClipMusicSelectionSchema = z
  .object({
    trackId: z.string().trim().min(1).max(128),
    source: ClipMusicSourceSchema,
    title: z.string().trim().min(1).max(160),
    artist: z.string().trim().max(160).nullable(),
    /** Offset into the track where the Clip's music starts. */
    startMs: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 1_000),
    volume: z.number().min(0).max(1),
  })
  .strict();
export type ClipMusicSelection = z.infer<typeof ClipMusicSelectionSchema>;

/**
 * Edit decisions applied on-device before upload (trim, segment concat, music
 * mix). Trim positions are on the concatenated source timeline.
 */
export const ClipEditMetadataSchema = z
  .object({
    music: ClipMusicSelectionSchema.nullable(),
    originalVolume: z.number().min(0).max(1),
    sourceTrimStartMs: z.number().int().min(0),
    sourceTrimEndMs: z.number().int().positive(),
    segmentCount: z.number().int().min(1).max(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    const durationMs = value.sourceTrimEndMs - value.sourceTrimStartMs;
    if (durationMs < MIN_CLIP_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceTrimEndMs"],
        message: "A Clip must be at least 1 second long",
      });
    }
    if (durationMs > MAX_CLIP_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceTrimEndMs"],
        message: "A Clip can be at most 90 seconds long",
      });
    }
  });
export type ClipEditMetadata = z.infer<typeof ClipEditMetadataSchema>;

/** Display-only attribution returned with feed items. */
export const ClipMusicAttributionSchema = z.object({
  trackId: z.string(),
  source: ClipMusicSourceSchema,
  title: z.string(),
  artist: z.string().nullable(),
});
export type ClipMusicAttribution = z.infer<typeof ClipMusicAttributionSchema>;

/**
 * A server-managed music track (`GET /v1/content/music-tracks`). Only tracks
 * the operator has rights to should be activated; an empty list is valid.
 */
export const MusicTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().nullable(),
  durationMs: z.number().int().positive(),
  url: z.string().url(),
  license: z.string(),
  attribution: z.string().nullable(),
});
export type MusicTrack = z.infer<typeof MusicTrackSchema>;

export const ListMusicTracksResponseSchema = z.object({
  tracks: z.array(MusicTrackSchema),
});
export type ListMusicTracksResponse = z.infer<
  typeof ListMusicTracksResponseSchema
>;

export const CreateContentContainerRequestSchema = z
  .object({
    format: ContentFormatSchema,
    mediaType: ContentMediaTypeSchema,
    caption: z.string().trim().max(2_200).default(""),
    mediaIds: z.array(z.string().uuid()).max(10).default([]),
    /** A custom cover is optional; the processor may provide a default poster. */
    thumbnailMediaId: z.string().uuid().nullable().optional(),
    hashtags: z.array(ContentHashtagSchema).max(30).default([]),
    taggedUserIds: z.array(z.string().uuid()).max(20).default([]),
    location: ContentLocationSchema.nullable().optional(),
    visibility: z
      .enum(["public", "followers", "friends", "community", "only_me"])
      .default("public"),
    /** Optional on-device edit metadata; only accepted for Clips. */
    edit: ClipEditMetadataSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.edit && value.format !== "clip") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edit"],
        message: "Edit metadata is only supported for Clips",
      });
    }
    if (value.mediaType === "text" && value.caption.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["caption"],
        message: "Text is required",
      });
    }
    if (value.mediaType !== "text" && value.mediaIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaIds"],
        message: "Media is required",
      });
    }
    if (value.format === "clip" && value.mediaType !== "video") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaType"],
        message: "Clips must be videos",
      });
    }
  });
export type CreateContentContainerRequest = z.infer<
  typeof CreateContentContainerRequestSchema
>;

/**
 * Mobile creator upload request. The server fixes access to public because a
 * Clip needs a safely deliverable source before it can enter the public feed.
 * Images are accepted here solely for an optional custom thumbnail/cover.
 */
export const CreateContentUploadRequestSchema = z
  .object({
    kind: z.enum(["video", "image"]),
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1),
    byteSize: z.number().int().positive(),
    durationMs: z.number().int().positive().optional(),
    width: z.number().int().positive().max(10_000).optional(),
    height: z.number().int().positive().max(10_000).optional(),
    visibility: z
      .enum(["public", "followers", "friends", "community", "only_me"])
      .default("public"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "video") {
      if (value.contentType.toLowerCase().split(";", 1)[0] !== "video/mp4") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentType"],
          message: "Clips must be uploaded as MP4 video",
        });
      }
      if (!value.durationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationMs"],
          message: "Video duration is required",
        });
      }
    }
  });
export type CreateContentUploadRequest = z.infer<
  typeof CreateContentUploadRequestSchema
>;

export const ContentVideoUploadSessionSchema = z.object({
  sessionId: z.string().uuid(),
  mediaId: z.string().uuid(),
  uploadUrl: z.string().url(),
  headers: z.record(z.string()),
  expiresAt: z.string().datetime(),
});
export type ContentVideoUploadSession = z.infer<
  typeof ContentVideoUploadSessionSchema
>;

export const ContentContainerSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "ready_to_publish", "published", "discarded"]),
  format: ContentFormatSchema,
  author: PublishingIdentitySchema,
  createdAt: z.string().datetime(),
});
export type ContentContainer = z.infer<typeof ContentContainerSchema>;

export const ContentPostSchema = z.object({
  id: z.string().uuid(),
  format: ContentFormatSchema,
  mediaType: ContentMediaTypeSchema,
  caption: z.string(),
  mediaIds: z.array(z.string().uuid()),
  thumbnailMediaId: z.string().uuid().nullable(),
  hashtags: z.array(ContentHashtagSchema),
  taggedUserIds: z.array(z.string().uuid()),
  location: ContentLocationSchema.nullable(),
  visibility: z.string(),
  author: PublishingIdentitySchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});
export type ContentPost = z.infer<typeof ContentPostSchema>;

export const ContentFeedSurfaceSchema = z.enum(["for_you", "following"]);
export type ContentFeedSurface = z.infer<typeof ContentFeedSurfaceSchema>;

export const ContentFeedQuerySchema = z.object({
  surface: ContentFeedSurfaceSchema.default("for_you"),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});
export type ContentFeedQuery = z.infer<typeof ContentFeedQuerySchema>;

/**
 * A client-generated event id makes a view/impression retry safe. The server
 * owns the aggregate counter and only records a meaningful amount of watch
 * time, rather than trusting a client-provided count.
 */
export const RecordContentClipViewRequestSchema = z
  .object({
    eventId: z.string().uuid(),
    watchedMs: z
      .number()
      .int()
      .min(1_000)
      .max(10 * 60 * 1_000),
  })
  .strict();
export type RecordContentClipViewRequest = z.infer<
  typeof RecordContentClipViewRequestSchema
>;

/** A state-setting API is idempotent across retries and multiple devices. */
export const SetContentClipLikeRequestSchema = z
  .object({ liked: z.boolean() })
  .strict();
export type SetContentClipLikeRequest = z.infer<
  typeof SetContentClipLikeRequestSchema
>;

export const ContentFeedItemSchema = ContentPostSchema.extend({
  /** Feed rows are only emitted after the post is published. */
  status: z.literal("published"),
  publishedAt: z.string().datetime(),
  /** The first playable video in a Clip. Additional media stays in mediaIds. */
  playbackUrl: z.string().url(),
  posterUrl: z.string().url().nullable(),
  duplicateClusterId: z.string().min(1),
  trendingScore: z.number(),
  /** Current viewer state is returned with the personalized feed item. */
  viewerHasLiked: z.boolean(),
  /** Music mixed into the Clip on-device, when the creator added any. */
  music: ClipMusicAttributionSchema.nullable().optional(),
  /** Duration of the playable video, when known. */
  durationMs: z.number().int().positive().nullable().optional(),
});
export type ContentFeedItem = z.infer<typeof ContentFeedItemSchema>;

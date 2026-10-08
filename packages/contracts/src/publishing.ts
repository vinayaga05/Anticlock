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

/** A publishing profile is the user's personal profile or one of their businesses. */
export const PublisherProfileTypeSchema = z.enum(["personal", "business"]);
export type PublisherProfileType = z.infer<typeof PublisherProfileTypeSchema>;

/**
 * Lifecycle of a piece of content. Only `published` content is ever returned
 * to other viewers; every other state is visible to the owner only.
 */
export const ContentLifecycleStatusSchema = z.enum([
  "draft",
  "uploading",
  "processing",
  "pending_review",
  "published",
  "rejected",
  "failed",
  "removed",
]);
export type ContentLifecycleStatus = z.infer<typeof ContentLifecycleStatusSchema>;

/**
 * Stored visibility values. `private` is accepted as an alias of the legacy
 * `only_me` value and normalized before persistence.
 */
export const ContentVisibilitySchema = z.enum([
  "public",
  "followers",
  "friends",
  "community",
  "only_me",
]);
export type ContentVisibility = z.infer<typeof ContentVisibilitySchema>;
export const ContentVisibilityInputSchema = z
  .enum(["public", "followers", "friends", "community", "only_me", "private"])
  .transform((value): ContentVisibility =>
    value === "private" ? "only_me" : value
  );

/**
 * Public author of a piece of content. Always derived on the server from
 * `publisherProfileId`; clients never supply display fields.
 */
export const ContentPublisherSchema = z.object({
  id: z.string().uuid(),
  type: PublisherProfileTypeSchema,
  displayName: z.string(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  verified: z.boolean(),
  businessCategory: z.string().nullable(),
});
export type ContentPublisher = z.infer<typeof ContentPublisherSchema>;

export const PublishingIdentitySchema = z.object({
  type: PublishingActorTypeSchema,
  id: z.string().uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: ProviderMembershipRoleSchema.optional(),
  /** Canonical publisher fields (additive; `type`/`name` kept for old clients). */
  profileType: PublisherProfileTypeSchema.optional(),
  publisher: ContentPublisherSchema.optional(),
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

type ContentShape = {
  format: ContentFormat;
  mediaType: ContentMediaType;
  caption: string;
  mediaIds: string[];
  edit?: ClipEditMetadata | null;
};

/** Shared create/publish validation for every content format. */
export function refineContentShape(value: ContentShape, ctx: z.RefinementCtx) {
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
}

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
    visibility: ContentVisibilityInputSchema.default("public"),
    /** Optional on-device edit metadata; only accepted for Clips. */
    edit: ClipEditMetadataSchema.nullable().optional(),
    /**
     * Explicit publishing profile. Older clients send the
     * `X-Anticlock-Context-*` headers instead; the body wins when both exist.
     */
    publisherProfileId: z.string().uuid().optional(),
    publisherProfileType: PublisherProfileTypeSchema.optional(),
  })
  .superRefine((value, ctx) => refineContentShape(value, ctx));
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
    visibility: ContentVisibilityInputSchema.default("public"),
    /** Optional draft this upload belongs to (moves it to `uploading`). */
    draftId: z.string().uuid().optional(),
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

/** `reel` is the product name for a Clip; both map to the `clip` format. */
export const DraftContentTypeSchema = z
  .enum(["clip", "reel", "flash", "story"])
  .transform((value): ContentFormat => (value === "reel" ? "clip" : value));

export const ContentDraftMetadataSchema = z
  .object({
    mediaType: ContentMediaTypeSchema.optional(),
    caption: z.string().trim().max(2_200).optional(),
    hashtags: z.array(ContentHashtagSchema).max(30).optional(),
    taggedUserIds: z.array(z.string().uuid()).max(20).optional(),
    location: ContentLocationSchema.nullable().optional(),
    edit: ClipEditMetadataSchema.nullable().optional(),
  })
  .strict();
export type ContentDraftMetadata = z.infer<typeof ContentDraftMetadataSchema>;

/** `POST /v1/content/drafts` */
export const CreateContentDraftRequestSchema = z
  .object({
    contentType: DraftContentTypeSchema,
    publisherProfileId: z.string().uuid(),
    publisherProfileType: PublisherProfileTypeSchema.optional(),
    visibility: ContentVisibilityInputSchema.default("public"),
    metadata: ContentDraftMetadataSchema.default({}),
  })
  .strict();
export type CreateContentDraftRequest = z.infer<
  typeof CreateContentDraftRequestSchema
>;

/** `PATCH /v1/content/drafts/:id` (owner only, before publish). */
export const UpdateContentDraftRequestSchema = z
  .object({
    mediaIds: z.array(z.string().uuid()).max(10).optional(),
    thumbnailMediaId: z.string().uuid().nullable().optional(),
    visibility: ContentVisibilityInputSchema.optional(),
    metadata: ContentDraftMetadataSchema.optional(),
  })
  .strict();
export type UpdateContentDraftRequest = z.infer<
  typeof UpdateContentDraftRequestSchema
>;

/**
 * `POST /v1/content/drafts/:id/publish`. The publisher is fixed when the
 * draft is created; a client may re-assert it, and a mismatch is rejected.
 */
export const PublishContentDraftRequestSchema = z
  .object({
    publisherProfileId: z.string().uuid().optional(),
  })
  .strict();
export type PublishContentDraftRequest = z.infer<
  typeof PublishContentDraftRequestSchema
>;

export const ContentDraftSchema = z.object({
  id: z.string().uuid(),
  contentType: ContentFormatSchema,
  contentStatus: ContentLifecycleStatusSchema,
  visibility: ContentVisibilitySchema,
  publisherProfileId: z.string().uuid(),
  publisherProfileType: PublisherProfileTypeSchema,
  publisher: ContentPublisherSchema,
  mediaIds: z.array(z.string().uuid()),
  thumbnailMediaId: z.string().uuid().nullable(),
  postId: z.string().uuid().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});
export type ContentDraft = z.infer<typeof ContentDraftSchema>;

export const ContentMediaItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["image", "video"]),
  url: z.string().url(),
});
export type ContentMediaItem = z.infer<typeof ContentMediaItemSchema>;

/** A viewer-safe post returned by feed and profile endpoints. */
export const ContentPostViewSchema = z.object({
  id: z.string().uuid(),
  format: ContentFormatSchema,
  mediaType: ContentMediaTypeSchema,
  contentStatus: ContentLifecycleStatusSchema,
  caption: z.string(),
  mediaIds: z.array(z.string().uuid()),
  media: z.array(ContentMediaItemSchema),
  posterUrl: z.string().url().nullable(),
  hashtags: z.array(z.string()),
  location: ContentLocationSchema.nullable(),
  visibility: ContentVisibilitySchema,
  publisherProfileId: z.string().uuid(),
  publisherProfileType: PublisherProfileTypeSchema,
  publisher: ContentPublisherSchema,
  /** Legacy author shape kept for older mobile builds. */
  author: PublishingIdentitySchema,
  viewCount: z.number().int(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  shareCount: z.number().int(),
  viewerHasLiked: z.boolean(),
  /** True when the viewer owns or manages this publisher. */
  viewerCanManage: z.boolean(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});
export type ContentPostView = z.infer<typeof ContentPostViewSchema>;

export const ContentPostsQuerySchema = z.object({
  format: ContentFormatSchema,
  publisherProfileId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Opaque cursor returned as `nextCursor`. */
  cursor: z.string().max(200).optional(),
});
export type ContentPostsQuery = z.infer<typeof ContentPostsQuerySchema>;

export const ContentProfileSummarySchema = z.object({
  publisher: ContentPublisherSchema,
  counts: z.object({
    posts: z.number().int(),
    clips: z.number().int(),
    flash: z.number().int(),
    stories: z.number().int(),
  }),
  viewerCanManage: z.boolean(),
});
export type ContentProfileSummary = z.infer<typeof ContentProfileSummarySchema>;

export const CreateContentCommentRequestSchema = z
  .object({
    body: z.string().trim().min(1).max(2_000),
    /** Comment as the personal profile (default) or an owned business. */
    publisherProfileId: z.string().uuid().optional(),
    publisherProfileType: PublisherProfileTypeSchema.optional(),
  })
  .strict();
export type CreateContentCommentRequest = z.infer<
  typeof CreateContentCommentRequestSchema
>;

export const ContentCommentSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  body: z.string(),
  publisherProfileId: z.string().uuid(),
  publisherProfileType: PublisherProfileTypeSchema,
  publisher: ContentPublisherSchema,
  createdAt: z.string().datetime(),
});
export type ContentComment = z.infer<typeof ContentCommentSchema>;

export const ReviewContentRequestSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1_000).optional(),
  })
  .strict();
export type ReviewContentRequest = z.infer<typeof ReviewContentRequestSchema>;

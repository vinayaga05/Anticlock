import { z } from 'zod';

/**
 * Lifecycle state is intentionally separate from the editor-facing mode.
 * Only `published` Reels are eligible for the public mobile feed.
 */
export const ReelStatusSchema = z.enum([
  'draft',
  'in_review',
  'published',
  'archived',
]);
export type ReelStatus = z.infer<typeof ReelStatusSchema>;

/** A test Reel is never publicly publishable; sample Reels may be published. */
export const ReelContentModeSchema = z.enum(['standard', 'test', 'sample']);
export type ReelContentMode = z.infer<typeof ReelContentModeSchema>;

export const ReelModerationStatusSchema = z.enum([
  'clear',
  'under_review',
  'restricted',
  'removed',
]);
export type ReelModerationStatus = z.infer<typeof ReelModerationStatusSchema>;

export const ReelReportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReelReportStatus = z.infer<typeof ReelReportStatusSchema>;

/**
 * The current categories shown in the mobile report flow. Keep the values
 * stable: reports are durable moderation records and should never depend on a
 * display label supplied by a client.
 */
export const GuidedReelReportReasonSchema = z.enum([
  'harmful_content',
  'bullying',
  'harassment',
  'violent_or_assault_content',
  'adult_or_pornographic_material',
  'hate_speech',
  'misinformation',
  'illegal_activity',
  'child_exploitation',
  'privacy_violation',
  'spam_or_scams',
]);
export type GuidedReelReportReason = z.infer<
  typeof GuidedReelReportReasonSchema
>;

/**
 * Includes historic report values so reports submitted before the guided flow
 * remain readable in moderation tools and can still be resolved safely.
 */
export const ReelReportReasonSchema = z.enum([
  ...GuidedReelReportReasonSchema.options,
  'spam',
  'nudity',
  'violence',
  'copyright',
  'other',
]);
export type ReelReportReason = z.infer<typeof ReelReportReasonSchema>;

export const ReelReportResolutionActionSchema = z.enum([
  'dismiss',
  'return_to_review',
  'restrict_reel',
  'remove_reel',
]);
export type ReelReportResolutionAction = z.infer<
  typeof ReelReportResolutionActionSchema
>;

export const ReelCtaEntityTypeSchema = z.enum([
  'provider',
  'event',
  'course',
  'product',
  'service_category',
]);
export type ReelCtaEntityType = z.infer<typeof ReelCtaEntityTypeSchema>;

export const ReelCtaSchema = z.object({
  entityType: ReelCtaEntityTypeSchema,
  entityId: z.string().min(1),
  ctaLabel: z.string().min(1).max(64).optional(),
});
export type ReelCta = z.infer<typeof ReelCtaSchema>;

export const ReelAdminSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  caption: z.string().nullable(),
  creatorName: z.string(),
  category: z.string().nullable(),
  status: ReelStatusSchema,
  contentMode: ReelContentModeSchema,
  moderationStatus: ReelModerationStatusSchema,
  isSample: z.boolean(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  saveCount: z.number().int(),
  viewCount: z.number().int(),
  completionCount: z.number().int(),
  completionRate: z.number().min(0).max(1),
  reportCount: z.number().int(),
  displayOrder: z.number().int(),
  mediaId: z.string().uuid().nullable(),
  thumbnailMediaId: z.string().uuid().nullable(),
  cta: ReelCtaSchema.nullable(),
  mediaProcessingStatus: z.string().nullable().optional(),
  mediaExternalId: z.string().nullable().optional(),
  playbackUrl: z.string().nullable().optional(),
  posterUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  submittedForReviewAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
});
export type ReelAdmin = z.infer<typeof ReelAdminSchema>;

export const ReelFeedItemSchema = z.object({
  id: z.string().uuid(),
  /** Defense-in-depth marker for mobile clients; the API only emits published rows. */
  status: z.literal('published'),
  title: z.string(),
  caption: z.string().nullable(),
  creatorName: z.string(),
  category: z.string().nullable(),
  playbackUrl: z.string().url(),
  posterUrl: z.string().url().nullable(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  saveCount: z.number().int(),
  cta: ReelCtaSchema.nullable(),
});
export type ReelFeedItem = z.infer<typeof ReelFeedItemSchema>;

export const CreateReelRequestSchema = z.object({
  title: z.string().min(1).max(200),
  caption: z.string().max(2000).optional(),
  creatorName: z.string().min(1).max(120),
  category: z.string().max(80).optional(),
  /** Editorial mode, independent of Draft → Review → Published lifecycle. */
  contentMode: ReelContentModeSchema.optional(),
  isSample: z.boolean().default(true),
  likeCount: z.number().int().min(0).default(0),
  commentCount: z.number().int().min(0).default(0),
  saveCount: z.number().int().min(0).default(0),
  displayOrder: z.number().int().default(0),
  cta: ReelCtaSchema.nullable().optional(),
  /** A ready public video from the Admin Media Library. */
  mediaId: z.string().uuid().optional(),
  /** Dev fallback when Stream is not configured */
  externalPlaybackUrl: z.string().url().optional(),
  externalPosterUrl: z.string().url().optional(),
});
export type CreateReelRequest = z.infer<typeof CreateReelRequestSchema>;

export const UpdateReelRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  caption: z.string().max(2000).nullable().optional(),
  creatorName: z.string().min(1).max(120).optional(),
  category: z.string().max(80).nullable().optional(),
  contentMode: ReelContentModeSchema.optional(),
  isSample: z.boolean().optional(),
  likeCount: z.number().int().min(0).optional(),
  commentCount: z.number().int().min(0).optional(),
  saveCount: z.number().int().min(0).optional(),
  displayOrder: z.number().int().optional(),
  cta: ReelCtaSchema.nullable().optional(),
  mediaId: z.string().uuid().nullable().optional(),
  thumbnailMediaId: z.string().uuid().nullable().optional(),
  externalPlaybackUrl: z.string().url().optional(),
  externalPosterUrl: z.string().url().optional(),
});
export type UpdateReelRequest = z.infer<typeof UpdateReelRequestSchema>;

/** The request is deliberately empty: the current admin is the submitter. */
export const SubmitReelForReviewRequestSchema = z.object({}).strict();
export type SubmitReelForReviewRequest = z.infer<
  typeof SubmitReelForReviewRequestSchema
>;

export const ReturnReelToDraftRequestSchema = z
  .object({
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
export type ReturnReelToDraftRequest = z.infer<
  typeof ReturnReelToDraftRequestSchema
>;

export const ReelAnalyticsEventRequestSchema = z
  .object({
    /** UUID generated by the client and used as the idempotency key. */
    eventId: z.string().uuid(),
    eventType: z.literal('view'),
    /** Watched time for this completed playback session, in milliseconds. */
    watchedMs: z.number().int().min(0).max(3 * 60 * 1000),
    completed: z.boolean(),
    sessionId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();
export type ReelAnalyticsEventRequest = z.infer<
  typeof ReelAnalyticsEventRequestSchema
>;

export const SetReelLikeRequestSchema = z
  .object({ liked: z.boolean() })
  .strict();
export type SetReelLikeRequest = z.infer<typeof SetReelLikeRequestSchema>;

export const CreateReelCommentRequestSchema = z
  .object({ body: z.string().trim().min(1).max(1000) })
  .strict();
export type CreateReelCommentRequest = z.infer<
  typeof CreateReelCommentRequestSchema
>;

export const CreateReelReportRequestSchema = z
  .object({
    reason: ReelReportReasonSchema,
    details: z.string().trim().max(1000).optional(),
  })
  .strict();
export type CreateReelReportRequest = z.infer<
  typeof CreateReelReportRequestSchema
>;

/** User-created Clips use content posts rather than the legacy editorial Reel table. */
export const CreateContentPostReportRequestSchema = CreateReelReportRequestSchema;
export type CreateContentPostReportRequest = z.infer<
  typeof CreateContentPostReportRequestSchema
>;

/** A profile is either a personal account or a business/provider profile. */
export const ProfileBlockTargetTypeSchema = z.enum(['user', 'business']);
export type ProfileBlockTargetType = z.infer<
  typeof ProfileBlockTargetTypeSchema
>;

export const ProfileBlockTargetSchema = z.object({
  type: ProfileBlockTargetTypeSchema,
  id: z.string().uuid(),
});
export type ProfileBlockTarget = z.infer<typeof ProfileBlockTargetSchema>;

export const CreateProfileBlockRequestSchema = ProfileBlockTargetSchema.strict();
export type CreateProfileBlockRequest = z.infer<
  typeof CreateProfileBlockRequestSchema
>;

export const ProfileBlockSchema = ProfileBlockTargetSchema.extend({
  createdAt: z.string().datetime(),
});
export type ProfileBlock = z.infer<typeof ProfileBlockSchema>;

export const ReelReportListQuerySchema = z.object({
  status: ReelReportStatusSchema.optional(),
  reelId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ReelReportListQuery = z.infer<typeof ReelReportListQuerySchema>;

export const ResolveReelReportRequestSchema = z
  .object({
    action: ReelReportResolutionActionSchema,
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
export type ResolveReelReportRequest = z.infer<
  typeof ResolveReelReportRequestSchema
>;

export const ReelReportAdminSchema = z.object({
  id: z.string().uuid(),
  reelId: z.string().uuid(),
  reelTitle: z.string(),
  reporterKey: z.string(),
  reporterKind: z.enum(['mobile_user', 'device']),
  reason: ReelReportReasonSchema,
  details: z.string().nullable(),
  status: ReelReportStatusSchema,
  resolutionAction: ReelReportResolutionActionSchema.nullable(),
  resolutionNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type ReelReportAdmin = z.infer<typeof ReelReportAdminSchema>;

export const ReelAnalyticsDaySchema = z.object({
  date: z.string(),
  views: z.number().int(),
  completedViews: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
});
export type ReelAnalyticsDay = z.infer<typeof ReelAnalyticsDaySchema>;

export const ReelAnalyticsSummarySchema = z.object({
  reelId: z.string().uuid(),
  views: z.number().int(),
  uniqueViewers: z.number().int(),
  completedViews: z.number().int(),
  completionRate: z.number().min(0).max(1),
  likes: z.number().int(),
  comments: z.number().int(),
  reports: z.number().int(),
  daily: z.array(ReelAnalyticsDaySchema),
});
export type ReelAnalyticsSummary = z.infer<typeof ReelAnalyticsSummarySchema>;

export const ReelListQuerySchema = z.object({
  status: ReelStatusSchema.optional(),
  contentMode: ReelContentModeSchema.optional(),
  isSample: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform(v => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    }),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type ReelListQuery = z.infer<typeof ReelListQuerySchema>;

export const ImportStreamReelRequestSchema = z.object({
  streamUid: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  caption: z.string().max(2000).optional(),
  creatorName: z.string().min(1).max(120),
  category: z.string().max(80).optional(),
  contentMode: ReelContentModeSchema.optional(),
  isSample: z.boolean().default(true),
  likeCount: z.number().int().min(0).default(0),
  commentCount: z.number().int().min(0).default(0),
  saveCount: z.number().int().min(0).default(0),
  displayOrder: z.number().int().default(0),
  cta: ReelCtaSchema.nullable().optional(),
});
export type ImportStreamReelRequest = z.infer<
  typeof ImportStreamReelRequestSchema
>;

export const CreateReelUploadSessionResponseSchema = z.object({
  reelId: z.string().uuid(),
  mediaId: z.string().uuid(),
  uploadUrl: z.string().url(),
  externalId: z.string(),
});
export type CreateReelUploadSessionResponse = z.infer<
  typeof CreateReelUploadSessionResponseSchema
>;

import { z } from 'zod';

export const ReelStatusSchema = z.enum(['draft', 'published', 'archived']);
export type ReelStatus = z.infer<typeof ReelStatusSchema>;

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
  isSample: z.boolean(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  saveCount: z.number().int(),
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
});
export type ReelAdmin = z.infer<typeof ReelAdminSchema>;

export const ReelFeedItemSchema = z.object({
  id: z.string().uuid(),
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
  isSample: z.boolean().default(true),
  likeCount: z.number().int().min(0).default(0),
  commentCount: z.number().int().min(0).default(0),
  saveCount: z.number().int().min(0).default(0),
  displayOrder: z.number().int().default(0),
  cta: ReelCtaSchema.nullable().optional(),
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
  isSample: z.boolean().optional(),
  likeCount: z.number().int().min(0).optional(),
  commentCount: z.number().int().min(0).optional(),
  saveCount: z.number().int().min(0).optional(),
  displayOrder: z.number().int().optional(),
  cta: ReelCtaSchema.nullable().optional(),
  thumbnailMediaId: z.string().uuid().nullable().optional(),
  externalPlaybackUrl: z.string().url().optional(),
  externalPosterUrl: z.string().url().optional(),
});
export type UpdateReelRequest = z.infer<typeof UpdateReelRequestSchema>;

export const ReelListQuerySchema = z.object({
  status: ReelStatusSchema.optional(),
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

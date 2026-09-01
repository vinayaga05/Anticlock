import { z } from 'zod';

export const MediaKindSchema = z.enum(['image', 'document', 'video']);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaAccessLevelSchema = z.enum(['public', 'private']);
export type MediaAccessLevel = z.infer<typeof MediaAccessLevelSchema>;

export const MediaProcessingStatusSchema = z.enum([
  'initiated',
  'uploading',
  'uploaded',
  'processing',
  'ready',
  'failed',
  'deleted',
]);
export type MediaProcessingStatus = z.infer<typeof MediaProcessingStatusSchema>;

export const MediaModerationStatusSchema = z.enum([
  'not_required',
  'pending',
  'approved',
  'rejected',
  'manual_review',
]);
export type MediaModerationStatus = z.infer<typeof MediaModerationStatusSchema>;

export const MediaStorageProviderSchema = z.enum([
  'r2',
  'local',
  'stream',
  'external',
]);
export type MediaStorageProvider = z.infer<typeof MediaStorageProviderSchema>;

export const MediaEntityTypeSchema = z.enum([
  'PROVIDER',
  'PROVIDER_APPLICATION',
  'PRODUCT',
  'BANNER',
  'REEL',
]);
export type MediaEntityType = z.infer<typeof MediaEntityTypeSchema>;

export const MediaUsageTypeSchema = z.enum([
  'PROFILE',
  'GALLERY',
  'HERO',
  'COVER',
  'ATTACHMENT',
  'VIDEO',
  'INTRO_VIDEO',
  'KYC_AADHAAR',
  'KYC_IDENTITY',
  'KYC_REGISTRATION',
]);
export type MediaUsageType = z.infer<typeof MediaUsageTypeSchema>;

/** Maximum Reel source duration accepted by the Admin upload flow. */
export const MAX_REEL_VIDEO_DURATION_MS = 3 * 60 * 1000;

/** Approved transform names — avoid arbitrary size combinations. */
export const MediaTransformSchema = z.enum([
  'avatar',
  'thumbnail',
  'card',
  'detail',
  'hero',
]);
export type MediaTransform = z.infer<typeof MediaTransformSchema>;

export const MediaAssetSchema = z.object({
  id: z.string().uuid(),
  kind: MediaKindSchema,
  storageProvider: MediaStorageProviderSchema,
  storageKey: z.string(),
  bucket: z.string(),
  mimeType: z.string().nullable(),
  byteSize: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  checksumSha256: z.string().nullable(),
  originalFilename: z.string().nullable(),
  accessLevel: MediaAccessLevelSchema,
  processingStatus: MediaProcessingStatusSchema,
  moderationStatus: MediaModerationStatusSchema,
  externalId: z.string().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  createdBy: z.string().uuid().nullable(),
  createdByName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  usageCount: z.number().int().optional(),
  deliveryUrl: z.string().url().nullable().optional(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MediaUsageSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
  entityType: MediaEntityTypeSchema,
  entityId: z.string(),
  usageType: MediaUsageTypeSchema,
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  entityLabel: z.string().optional(),
});
export type MediaUsage = z.infer<typeof MediaUsageSchema>;

export const CreateUploadSessionRequestSchema = z
  .object({
    kind: MediaKindSchema,
    accessLevel: MediaAccessLevelSchema.default('public'),
    filename: z.string().min(1).max(255),
    contentType: z.string().min(1),
    byteSize: z.number().int().positive(),
    /** Read from the browser's video metadata before requesting an R2 URL. */
    durationMs: z.number().int().positive().optional(),
    width: z.number().int().positive().max(10_000).optional(),
    height: z.number().int().positive().max(10_000).optional(),
    entityHint: z.string().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== 'video') return;
    if (!value.durationMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['durationMs'],
        message: 'Video duration is required',
      });
      return;
    }
    if (value.durationMs > MAX_REEL_VIDEO_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['durationMs'],
        message: 'Reel videos must be 3 minutes or shorter',
      });
    }
  });
export type CreateUploadSessionRequest = z.infer<
  typeof CreateUploadSessionRequestSchema
>;

export const CreateUploadSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  mediaId: z.string().uuid(),
  uploadUrl: z.string().url(),
  headers: z.record(z.string()),
  storageKey: z.string(),
  expiresAt: z.string().datetime(),
});
export type CreateUploadSessionResponse = z.infer<
  typeof CreateUploadSessionResponseSchema
>;

export const CompleteUploadRequestSchema = z.object({
  checksumSha256: z.string().length(64).optional(),
});
export type CompleteUploadRequest = z.infer<typeof CompleteUploadRequestSchema>;

export const CompleteUploadResponseSchema = z.object({
  asset: MediaAssetSchema,
  duplicateOf: MediaAssetSchema.nullable().optional(),
});
export type CompleteUploadResponse = z.infer<
  typeof CompleteUploadResponseSchema
>;

/** A moderator can clear, hold, or reject a ready asset without changing its bytes. */
export const SetMediaModerationStatusRequestSchema = z
  .object({
    status: z.enum(['approved', 'manual_review', 'rejected']),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
export type SetMediaModerationStatusRequest = z.infer<
  typeof SetMediaModerationStatusRequestSchema
>;

export const MediaListQuerySchema = z.object({
  q: z.string().optional(),
  kind: MediaKindSchema.optional(),
  status: MediaProcessingStatusSchema.optional(),
  accessLevel: MediaAccessLevelSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type MediaListQuery = z.infer<typeof MediaListQuerySchema>;

export const AttachMediaUsageRequestSchema = z.object({
  mediaId: z.string().uuid(),
  entityType: MediaEntityTypeSchema,
  entityId: z.string().min(1),
  usageType: MediaUsageTypeSchema,
  sortOrder: z.number().int().default(0),
});
export type AttachMediaUsageRequest = z.infer<
  typeof AttachMediaUsageRequestSchema
>;

export const StubProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  profileMediaId: z.string().uuid().nullable().optional(),
  profileDeliveryUrl: z.string().nullable().optional(),
});
export type StubProvider = z.infer<typeof StubProviderSchema>;

export const StubProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  gallery: z
    .array(
      z.object({
        mediaId: z.string().uuid(),
        deliveryUrl: z.string().nullable(),
        sortOrder: z.number().int(),
      }),
    )
    .optional(),
});
export type StubProduct = z.infer<typeof StubProductSchema>;

export const StubBannerSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  heroMediaId: z.string().uuid().nullable().optional(),
  heroDeliveryUrl: z.string().nullable().optional(),
});
export type StubBanner = z.infer<typeof StubBannerSchema>;

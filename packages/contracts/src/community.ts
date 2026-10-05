import { z } from 'zod';

export const CommunityStatusSchema = z.enum(['draft', 'published', 'archived']);
export type CommunityStatus = z.infer<typeof CommunityStatusSchema>;

export const CommunityRoleSchema = z.enum(['owner', 'moderator', 'member']);
export type CommunityRole = z.infer<typeof CommunityRoleSchema>;

export const CommunitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  coverUrl: z.string().url().optional(),
  memberCount: z.number().int().nonnegative(),
  postCount: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  status: CommunityStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  suspendedAt: z.string().datetime().nullable(),
});
export type Community = z.infer<typeof CommunitySchema>;

export const CommunityDetailSchema = CommunitySchema.extend({
  ownerName: z.string(),
  ownerAvatarUrl: z.string().url().optional(),
  isMember: z.boolean().optional(),
  myRole: CommunityRoleSchema.nullable().optional(),
});
export type CommunityDetail = z.infer<typeof CommunityDetailSchema>;

export const CreateCommunityRequestSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
});
export type CreateCommunityRequest = z.infer<typeof CreateCommunityRequestSchema>;

export const UpdateCommunityRequestSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
  status: CommunityStatusSchema.optional(),
});
export type UpdateCommunityRequest = z.infer<typeof UpdateCommunityRequestSchema>;

export const CommunityMemberSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  role: CommunityRoleSchema,
  userName: z.string(),
  userAvatarUrl: z.string().url().optional(),
  joinedAt: z.string().datetime(),
});
export type CommunityMember = z.infer<typeof CommunityMemberSchema>;

export const CommunityListQuerySchema = z.object({
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  status: CommunityStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type CommunityListQuery = z.infer<typeof CommunityListQuerySchema>;

export const CommunityListResponseSchema = z.object({
  communities: z.array(CommunityDetailSchema),
  nextCursor: z.string().nullable(),
});
export type CommunityListResponse = z.infer<typeof CommunityListResponseSchema>;

export const CommunityPostSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  authorAvatarUrl: z.string().url().optional(),
  content: z.string(),
  mediaUrl: z.string().url().optional(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  isLiked: z.boolean().optional(),
  status: z.enum(['visible', 'removed']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  removedAt: z.string().datetime().nullable(),
});
export type CommunityPost = z.infer<typeof CommunityPostSchema>;

export const CreateCommunityPostRequestSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaAssetId: z.string().uuid().optional(),
});
export type CreateCommunityPostRequest = z.infer<typeof CreateCommunityPostRequestSchema>;

export const CommunityPostListQuerySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type CommunityPostListQuery = z.infer<typeof CommunityPostListQuerySchema>;

export const CommunityPostListResponseSchema = z.object({
  posts: z.array(CommunityPostSchema),
  nextCursor: z.string().nullable(),
});
export type CommunityPostListResponse = z.infer<typeof CommunityPostListResponseSchema>;

export const CommunityPostCommentSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  authorAvatarUrl: z.string().url().optional(),
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type CommunityPostComment = z.infer<typeof CommunityPostCommentSchema>;

export const CreateCommentRequestSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

export const CommentListResponseSchema = z.object({
  comments: z.array(CommunityPostCommentSchema),
});
export type CommentListResponse = z.infer<typeof CommentListResponseSchema>;

export const ReportPostRequestSchema = z.object({
  reason: z.enum([
    'spam',
    'harassment',
    'inappropriate',
    'misinformation',
    'other',
  ]),
  details: z.string().max(1000).optional(),
});
export type ReportPostRequest = z.infer<typeof ReportPostRequestSchema>;

export const CommunityPostReportSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  reporterMobileUserId: z.string().uuid(),
  reporterName: z.string(),
  communityName: z.string(),
  postContent: z.string(),
  reason: z.string(),
  details: z.string().optional(),
  status: z.enum(['open', 'resolved']),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type CommunityPostReport = z.infer<typeof CommunityPostReportSchema>;

export const UpdateCommunityRoleRequestSchema = z.object({
  role: CommunityRoleSchema,
});
export type UpdateCommunityRoleRequest = z.infer<typeof UpdateCommunityRoleRequestSchema>;

export const CommunityAdminQuerySchema = z.object({
  status: CommunityStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type CommunityAdminQuery = z.infer<typeof CommunityAdminQuerySchema>;

export const SuspendCommunityRequestSchema = z.object({
  reason: z.string().max(1000),
});
export type SuspendCommunityRequest = z.infer<typeof SuspendCommunityRequestSchema>;

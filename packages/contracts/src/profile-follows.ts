import { z } from 'zod';
import { PublisherProfileTypeSchema } from './publishing.js';

/** A profile is either the account's personal profile or one business profile. */
export const ProfileRefSchema = z
  .object({
    id: z.string().uuid(),
    type: PublisherProfileTypeSchema,
  })
  .strict();
export type ProfileRef = z.infer<typeof ProfileRefSchema>;

export const ProfileFollowStatusSchema = z.enum(['not_following', 'requested', 'following', 'blocked']);
export type ProfileFollowStatus = z.infer<typeof ProfileFollowStatusSchema>;

/** Follow writes always name both profiles. Ownership is verified server-side. */
export const CreateProfileFollowRequestSchema = z
  .object({
    followerProfileId: z.string().uuid(),
    followerProfileType: PublisherProfileTypeSchema,
    followedProfileId: z.string().uuid(),
    followedProfileType: PublisherProfileTypeSchema,
  })
  .strict();
export type CreateProfileFollowRequest = z.infer<typeof CreateProfileFollowRequestSchema>;

export const ProfileFollowTargetSchema = z
  .object({
    profileId: z.string().uuid(),
    profileType: PublisherProfileTypeSchema,
  })
  .strict();
export type ProfileFollowTarget = z.infer<typeof ProfileFollowTargetSchema>;

export const ProfilePrivacyUpdateSchema = z
  .object({
    isPrivate: z.boolean(),
    allowFollowRequests: z.boolean().optional(),
    showFollowerLists: z.boolean().optional(),
  })
  .strict();
export type ProfilePrivacyUpdate = z.infer<typeof ProfilePrivacyUpdateSchema>;

export const ProfileRelationshipSchema = z.object({
  canFollow: z.boolean(),
  followStatus: ProfileFollowStatusSchema,
  isFollowing: z.boolean(),
  isRequested: z.boolean(),
  isBlocked: z.boolean(),
  canViewContent: z.boolean(),
});
export type ProfileRelationship = z.infer<typeof ProfileRelationshipSchema>;

export const ProfileFollowSchema = z.object({
  id: z.string().uuid(),
  follower: ProfileRefSchema,
  followed: ProfileRefSchema,
  status: z.enum(['pending', 'accepted']),
  createdAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type ProfileFollow = z.infer<typeof ProfileFollowSchema>;

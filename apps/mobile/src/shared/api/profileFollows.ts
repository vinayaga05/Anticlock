import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';

export type ProfileRef = { id: string; type: PublisherProfileType };
export type ProfileRelationship = {
  canFollow: boolean;
  followStatus: 'not_following' | 'requested' | 'following' | 'blocked';
  isFollowing: boolean;
  isRequested: boolean;
  isBlocked: boolean;
  canViewContent: boolean;
};

export type ProfilePrivacy = {
  isPrivate: boolean;
  allowFollowRequests: boolean;
  showFollowerLists: boolean;
};

function followPayload(follower: ProfileRef, followed: ProfileRef) {
  return {
    followerProfileId: follower.id,
    followerProfileType: follower.type,
    followedProfileId: followed.id,
    followedProfileType: followed.type,
  };
}

export type ProfileSocialCounts = {
  followers: number;
  following: number;
  pendingRequests: number;
};

export type ProfileFollowMutationResponse = {
  relationship: ProfileRelationship;
  followedCounts: ProfileSocialCounts;
  followerCounts: ProfileSocialCounts;
};

export async function followProfile(follower: ProfileRef, followed: ProfileRef) {
  return apiRequest<{ data: ProfileFollowMutationResponse }>('/v1/profile-follows', {
    method: 'POST', body: JSON.stringify(followPayload(follower, followed)),
  });
}

export async function unfollowProfile(follower: ProfileRef, followed: ProfileRef) {
  return apiRequest<{ data: ProfileFollowMutationResponse & { removed: boolean } }>('/v1/profile-follows', {
    method: 'DELETE', body: JSON.stringify(followPayload(follower, followed)),
  });
}

export type IncomingFollowRequest = {
  id: string;
  follower: {
    id: string;
    type: PublisherProfileType;
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
  };
  createdAt: string;
};

export function useFollowRequestsQuery(profile: ProfileRef | null) {
  return useQuery({
    queryKey: ['profile-follows', 'requests', profile?.type ?? '', profile?.id ?? ''],
    queryFn: async () => {
      if (!profile) return [];
      const response = await apiRequest<{ data: IncomingFollowRequest[] }>(
        `/v1/profile-follows/requests/${profile.type}/${profile.id}`,
      );
      return response.data;
    },
    enabled: Boolean(profile),
    staleTime: 10_000,
  });
}

export function useFollowRequestAction(profile: ProfileRef | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, follower }: { action: 'accept' | 'reject' | 'block'; follower: ProfileRef }) => {
      if (!profile) throw new Error('Profile identity unavailable');
      if (action === 'block') {
        return apiRequest('/v1/profile-follows/blocks', {
          method: 'POST',
          body: JSON.stringify(followPayload(profile, follower)),
        });
      }
      return apiRequest(`/v1/profile-follows/requests/${profile.type}/${profile.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(follower),
      });
    },
    onSuccess: async () => {
      if (!profile) return;
      await Promise.all([
        client.invalidateQueries({ queryKey: ['profile-follows', 'requests', profile.type, profile.id] }),
        client.invalidateQueries({ queryKey: contentQueryKeys.profile(profile.type, profile.id) }),
      ]);
    },
  });
}

export async function updateProfilePrivacy(profile: ProfileRef, privacy: ProfilePrivacy) {
  return apiRequest<{ data: ProfilePrivacy }>(
    `/v1/profile-follows/privacy/${profile.type}/${profile.id}`,
    { method: 'PATCH', body: JSON.stringify(privacy) },
  );
}

export function useProfilePrivacyMutation(profile: ProfileRef | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (privacy: ProfilePrivacy) => {
      if (!profile) throw new Error('Profile identity unavailable');
      return updateProfilePrivacy(profile, privacy);
    },
    onSuccess: async () => {
      if (profile) await client.invalidateQueries({ queryKey: contentQueryKeys.profile(profile.type, profile.id) });
    },
  });
}

/** Reconciles profile header and content against server responses after mutations. */
export function useProfileFollowMutation(follower: ProfileRef | null, followed: ProfileRef | null) {
  const client = useQueryClient();
  const invalidate = async () => {
    if (!followed) return;
    await Promise.all([
      client.invalidateQueries({ queryKey: contentQueryKeys.profile(followed.type, followed.id) }),
      ...(follower
        ? [client.invalidateQueries({ queryKey: contentQueryKeys.profile(follower.type, follower.id) })]
        : []),
      client.invalidateQueries({ queryKey: contentQueryKeys.profilePosts(followed.type, followed.id, 'clip') }),
      client.invalidateQueries({ queryKey: contentQueryKeys.profilePosts(followed.type, followed.id, 'flash') }),
      client.invalidateQueries({ queryKey: contentQueryKeys.clipsFeed }),
      client.invalidateQueries({ queryKey: contentQueryKeys.flashFeed }),
      client.invalidateQueries({ queryKey: contentQueryKeys.storyTray }),
      client.invalidateQueries({ queryKey: ['profile-follows', 'connections'] }),
    ]);
  };
  return useMutation({
    mutationFn: async (next: 'follow' | 'unfollow') => {
      if (!follower || !followed) throw new Error('Profile identity unavailable');
      return next === 'follow' ? followProfile(follower, followed) : unfollowProfile(follower, followed);
    },
    onSuccess: async response => {
      if (followed) {
        client.setQueriesData(
          { queryKey: contentQueryKeys.profile(followed.type, followed.id) },
          (current: any) => current
            ? {
                ...current,
                relationship: response.data.relationship,
                socialCounts: response.data.followedCounts,
              }
            : current,
        );
      }
      if (follower) {
        client.setQueriesData(
          { queryKey: contentQueryKeys.profile(follower.type, follower.id) },
          (current: any) => current
            ? { ...current, socialCounts: response.data.followerCounts }
            : current,
        );
      }
      await invalidate();
    },
  });
}

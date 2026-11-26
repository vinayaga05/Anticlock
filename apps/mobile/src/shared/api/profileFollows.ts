import { useMutation, useQuery, useQueryClient, useInfiniteQuery, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import type { ProfileConnectionsPage } from '@anticlock/contracts';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';

export type ProfileRef = { id: string; type: PublisherProfileType };
export type ProfileRelationship = {
  canFollow: boolean;
  followStatus: 'not_following' | 'requested' | 'following' | 'blocked';
  isFollowing: boolean;
  isRequested: boolean;
  isBlocked: boolean;
  canViewContent: boolean;
  canMessage: boolean;
};

export type ProfilePrivacy = {
  isPrivate: boolean;
  allowFollowRequests: boolean;
  showFollowerLists: boolean;
  allowMessages: boolean;
};

function followPayload(follower: ProfileRef, followed: ProfileRef) {
  return {
    followerProfileId: follower.id,
    followerProfileType: follower.type,
    followedProfileId: followed.id,
    followedProfileType: followed.type,
  };
}

export async function blockProfile(blocker: ProfileRef, blocked: ProfileRef) {
  return apiRequest<{ data: { blocked: true } }>('/v1/profile-follows/blocks', {
    method: 'POST',
    body: JSON.stringify(followPayload(blocker, blocked)),
  });
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
    handle?: string | null;
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
    onSuccess: async () => { await reconcileSocialState(client); },
  });
}

export async function updateProfilePrivacy(profile: ProfileRef, privacy: Partial<ProfilePrivacy>) {
  return apiRequest<{ data: ProfilePrivacy }>(
    `/v1/profile-follows/privacy/${profile.type}/${profile.id}`,
    { method: 'PATCH', body: JSON.stringify(privacy) },
  );
}

export function useProfilePrivacyMutation(profile: ProfileRef | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (privacy: Partial<ProfilePrivacy>) => {
      if (!profile) throw new Error('Profile identity unavailable');
      return updateProfilePrivacy(profile, privacy);
    },
    onSuccess: async () => { await reconcileSocialState(client); },
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
      await reconcileSocialState(client);
    },
  });
}

/** Clear restricted content before refetching: invalidation alone leaves old
 * private posts visible while a revoked relationship is being refreshed. */
export async function reconcileSocialState(client: QueryClient) {
  const keys = [['content'], ['reels'], ['profile-follows'], ['business-profile'], ['search'], ['people']];
  await Promise.all(keys.map(queryKey => client.cancelQueries({ queryKey })));
  await Promise.all(keys.map(queryKey => client.resetQueries({ queryKey })));
}

export function useProfileConnections(target: ProfileRef, viewer: ProfileRef | null, direction: 'followers' | 'following') {
  return useInfiniteQuery({
    queryKey: ['profile-follows', 'connections', target.type, target.id, direction, viewer?.type, viewer?.id],
    enabled: Boolean(viewer),
    staleTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '30', viewerProfileId: viewer!.id, viewerProfileType: viewer!.type });
      if (pageParam) params.set('cursor', pageParam);
      const result = await connectionPageRequest<{ data: ProfileConnectionsPage }>(
        `/v1/profile-follows/connections/${target.type}/${target.id}/${direction}?${params}`, signal);
      if (!result.data || !Array.isArray(result.data.items) || typeof result.data.isOwner !== 'boolean') throw new Error('Connections are temporarily unavailable. Please try again later.');
      return result.data;
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
}

export function useRemoveFollower(profile: ProfileRef) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (follower: ProfileRef) => apiRequest(`/v1/profile-follows/followers/${profile.type}/${profile.id}`, {
      method: 'DELETE', body: JSON.stringify(follower),
    }),
    onSuccess: async () => { await reconcileSocialState(client); },
  });
}

async function connectionPageRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  else signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 20_000);
  try { return await apiRequest<T>(path, { signal: controller.signal }); }
  finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel); }
}

export function usePagedFollowRequests(profile: ProfileRef | null) {
  return useInfiniteQuery({
    queryKey: ['profile-follows', 'requests', profile?.type, profile?.id, 'pages'],
    enabled: Boolean(profile), initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('cursor', pageParam);
      const result = await connectionPageRequest<{ data: { items: IncomingFollowRequest[]; nextCursor: string | null } }>(
        `/v1/profile-follows/requests/${profile!.type}/${profile!.id}/page?${params}`, signal);
      return result.data;
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
}

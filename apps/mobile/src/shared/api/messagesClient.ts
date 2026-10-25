import { apiClient } from './client';

export interface CreateChannelRequest {
  otherProfile: { id: string; type: 'personal' | 'business' };
  viewerProfile: { id: string; type: 'personal' | 'business' };
}

export interface CreateChannelResponse {
  channelId: string;
  profile: {
    id: string;
    type: 'personal' | 'business';
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
  };
}

export type PublisherRef = { id: string; type: 'personal' | 'business' };

export interface CreateCallResponse {
  callId: string;
  callType: 'default';
  mode: 'audio' | 'video';
  targetUserId: string;
  profile: CreateChannelResponse['profile'];
}

/**
 * Create or get a 1:1 messaging channel with another user
 */
export async function createOrGetChannel(
  otherProfile: CreateChannelRequest['otherProfile'],
  viewerProfile: CreateChannelRequest['viewerProfile'],
): Promise<CreateChannelResponse> {
  return apiClient.post<CreateChannelResponse>('/v1/messages/channels', {
    otherProfile,
    viewerProfile,
  });
}

export async function createVideoCall(
  otherProfile: PublisherRef,
  viewerProfile: PublisherRef,
  mode: 'audio' | 'video',
): Promise<CreateCallResponse> {
  return apiClient.post<CreateCallResponse>('/v1/messages/calls', {
    otherProfile,
    viewerProfile,
    mode,
  });
}

export async function reportConversation(
  channelId: string,
  viewerProfile: PublisherRef,
  otherProfile: PublisherRef,
  reason: 'spam' | 'harassment' | 'impersonation' | 'unsafe' | 'other',
) {
  return apiClient.post<{ data: { id: string; status: string } }>(
    `/v1/messages/channels/${encodeURIComponent(channelId)}/report`,
    { viewerProfile, otherProfile, reason },
  );
}

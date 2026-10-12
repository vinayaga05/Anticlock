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

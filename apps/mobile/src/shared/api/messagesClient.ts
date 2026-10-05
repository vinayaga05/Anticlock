import { apiClient } from './client';

export interface CreateChannelRequest {
  otherUserId: string;
}

export interface CreateChannelResponse {
  channelId: string;
}

/**
 * Create or get a 1:1 messaging channel with another user
 */
export async function createOrGetChannel(
  otherUserId: string
): Promise<CreateChannelResponse> {
  return apiClient.post<CreateChannelResponse>('/v1/messages/channels', {
    otherUserId,
  });
}

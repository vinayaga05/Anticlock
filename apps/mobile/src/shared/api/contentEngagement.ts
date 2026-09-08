import { apiRequest, getApiToken } from './client';
import { isApiEnabled } from './config';

type ContentClipViewResult = {
  data: {
    recorded: boolean;
    viewCount?: number;
  };
};

type ContentClipLikeResult = {
  data: {
    liked: boolean;
    changed: boolean;
    likeCount?: number;
  };
};

/**
 * Records a single meaningful playback for a published content Clip. The
 * caller owns the event id so a retry can be deduplicated by the API.
 */
export async function recordContentClipView(
  postId: string,
  event: { eventId: string; watchedMs: number },
): Promise<ContentClipViewResult['data'] | null> {
  if (!isApiEnabled || !getApiToken()) return null;

  try {
    const response = await apiRequest<ContentClipViewResult>(
      `/v1/content/posts/${encodeURIComponent(postId)}/view-events`,
      {
        method: 'POST',
        body: JSON.stringify({
          eventId: event.eventId,
          watchedMs: Math.max(1_000, Math.round(event.watchedMs)),
        }),
      },
    );
    return response.data;
  } catch {
    // Engagement must never interrupt video playback or a user interaction.
    return null;
  }
}

/** Sets the viewer's like state. The API owns the aggregate counter. */
export async function setContentClipLike(
  postId: string,
  liked: boolean,
): Promise<ContentClipLikeResult['data'] | null> {
  if (!isApiEnabled || !getApiToken()) return null;
  const response = await apiRequest<ContentClipLikeResult>(
    `/v1/content/posts/${encodeURIComponent(postId)}/like`,
    {
      method: 'PUT',
      body: JSON.stringify({ liked }),
    },
  );
  return response.data;
}

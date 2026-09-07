import { ApiError, apiRequest, getApiToken } from './client';
import { isApiEnabled } from './config';

/** Keep in sync with the server's GuidedReelReportReasonSchema. */
export type ReportVideoReason =
  | 'harmful_content'
  | 'bullying'
  | 'harassment'
  | 'violent_or_assault_content'
  | 'adult_or_pornographic_material'
  | 'hate_speech'
  | 'misinformation'
  | 'illegal_activity'
  | 'child_exploitation'
  | 'privacy_violation'
  | 'spam_or_scams';

export type ProfileBlockTarget = {
  type: 'user' | 'business';
  id: string;
};

export type ProfileBlock = ProfileBlockTarget & {
  createdAt: string;
};

function requireSignedInApi() {
  if (!isApiEnabled) {
    throw new ApiError(0, 'api_disabled', 'Reporting and blocking are available when the API is connected.');
  }
  if (!getApiToken()) {
    throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
  }
}

/** Submit the selected guided reason to the server-owned moderation queue. */
export async function reportReel(
  reelId: string,
  reason: ReportVideoReason,
): Promise<void> {
  requireSignedInApi();
  await apiRequest<{ data: { id: string } }>(
    `/v1/reels/${encodeURIComponent(reelId)}/reports`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

/** Report a profile-published Clip from the `/v1/content` feed. */
export async function reportContentPost(
  contentPostId: string,
  reason: ReportVideoReason,
): Promise<void> {
  requireSignedInApi();
  await apiRequest<{ data: { id: string } }>(
    `/v1/content/posts/${encodeURIComponent(contentPostId)}/reports`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

/** Block exactly one personal account or business profile for the signed-in viewer. */
export async function blockProfile(target: ProfileBlockTarget): Promise<ProfileBlock> {
  requireSignedInApi();
  const result = await apiRequest<{ data: ProfileBlock }>('/v1/blocks', {
    method: 'POST',
    body: JSON.stringify(target),
  });
  return result.data;
}

export async function unblockProfile(target: ProfileBlockTarget): Promise<boolean> {
  requireSignedInApi();
  const result = await apiRequest<{ data: { removed: boolean } }>(
    `/v1/blocks/${target.type}/${encodeURIComponent(target.id)}`,
    { method: 'DELETE' },
  );
  return result.data.removed;
}

export async function listBlockedProfiles(): Promise<ProfileBlock[]> {
  requireSignedInApi();
  const result = await apiRequest<{ data: ProfileBlock[] }>('/v1/blocks');
  return result.data;
}

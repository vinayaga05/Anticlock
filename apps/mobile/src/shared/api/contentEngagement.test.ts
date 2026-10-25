jest.mock('./client', () => ({
  apiRequest: jest.fn(),
  getApiToken: jest.fn(() => 'token'),
}));
jest.mock('./config', () => ({ isApiEnabled: true }));

import { apiRequest } from './client';
import {
  createContentComment,
  fetchContentComments,
  setContentClipLike,
} from './contentEngagement';

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;
const business = {
  id: '1da5338f-b16c-48fd-b8e5-c552c4b84860',
  type: 'business' as const,
};

describe('content engagement API', () => {
  beforeEach(() => request.mockReset());

  it('sends the active business profile when setting a like', async () => {
    request.mockResolvedValue({
      data: { liked: true, changed: true, likeCount: 4 },
    });

    await setContentClipLike('post/id', true, business);

    expect(request).toHaveBeenCalledWith(
      `/v1/content/posts/post%2Fid/like?viewerProfileId=${business.id}&viewerProfileType=business`,
      { method: 'PUT', body: JSON.stringify({ liked: true }) },
    );
  });

  it('loads comments using the same viewer profile as the feed', async () => {
    request.mockResolvedValue({ items: [] });

    await fetchContentComments('post-1', business);

    expect(request).toHaveBeenCalledWith(
      `/v1/content/posts/post-1/comments?viewerProfileId=${business.id}&viewerProfileType=business`,
    );
  });

  it('publishes a comment as the selected business', async () => {
    request.mockResolvedValue({ comment: null });

    await createContentComment('post-1', 'Looks good', business);

    expect(request).toHaveBeenCalledWith('/v1/content/posts/post-1/comments', {
      method: 'POST',
      body: JSON.stringify({
        body: 'Looks good',
        publisherProfileId: business.id,
        publisherProfileType: business.type,
      }),
    });
  });
});

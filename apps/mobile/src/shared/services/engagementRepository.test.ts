jest.mock('@/shared/api/contentEngagement', () => ({
  createContentComment: jest.fn(),
  fetchContentComments: jest.fn(),
  setContentPostLike: jest.fn(),
}));

import {
  createContentComment,
  fetchContentComments,
} from '@/shared/api/contentEngagement';
import { useEngagementStore } from './engagementRepository';

const createComment = createContentComment as jest.MockedFunction<
  typeof createContentComment
>;
const fetchComments = fetchContentComments as jest.MockedFunction<
  typeof fetchContentComments
>;

const postId = '5ffea844-f7b8-485a-841c-a53ccf59ac95';
const business = {
  id: '1da5338f-b16c-48fd-b8e5-c552c4b84860',
  type: 'business' as const,
  name: 'Lotus Studio',
  avatarUrl: 'https://cdn.example.com/lotus.jpg',
};
const serverComment = {
  id: 'd14c2304-8d8b-4ead-8adb-d762b8fe2c42',
  postId,
  body: 'Great clip',
  publisherProfileId: business.id,
  publisherProfileType: business.type,
  publisher: {
    id: business.id,
    type: business.type,
    displayName: business.name,
    handle: 'lotus',
    avatarUrl: business.avatarUrl,
    verified: false,
  },
  createdAt: '2026-10-25T05:30:00.000Z',
};

describe('server-backed Clip comments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEngagementStore.setState({ comments: [], commentCounts: {} });
  });

  it('loads Clip comments even though Clips are not Flash store posts', async () => {
    fetchComments.mockResolvedValue([serverComment]);

    await useEngagementStore
      .getState()
      .syncApiComments(postId, business, true);

    expect(fetchComments).toHaveBeenCalledWith(postId, business);
    expect(useEngagementStore.getState().getComments(postId)).toEqual([
      expect.objectContaining({
        id: serverComment.id,
        text: serverComment.body,
        isOwn: true,
      }),
    ]);
  });

  it('persists a Clip comment as the active business and reconciles its id', async () => {
    createComment.mockResolvedValue(serverComment);

    await useEngagementStore
      .getState()
      .createComment(postId, serverComment.body, business, true);

    expect(createComment).toHaveBeenCalledWith(
      postId,
      serverComment.body,
      business,
    );
    expect(useEngagementStore.getState().getComments(postId)).toEqual([
      expect.objectContaining({
        id: serverComment.id,
        author: expect.objectContaining({
          id: business.id,
          name: business.name,
          profileType: 'business',
        }),
      }),
    ]);
    expect(useEngagementStore.getState().commentCounts[postId]).toBe(1);
  });

  it('rolls back the optimistic comment when the API rejects it', async () => {
    createComment.mockRejectedValue(new Error('offline'));
    useEngagementStore.getState().setKnownCommentCount(postId, 3);

    const saved = await useEngagementStore
      .getState()
      .createComment(postId, 'Will fail', business, true);

    expect(saved).toBe(false);
    expect(useEngagementStore.getState().getComments(postId)).toEqual([]);
    expect(useEngagementStore.getState().commentCounts[postId]).toBe(3);
  });
});

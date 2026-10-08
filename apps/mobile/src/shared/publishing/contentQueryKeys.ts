import type { QueryClient } from '@tanstack/react-query';
import type { PublishFormat, PublisherProfileType } from './publisherSelection';

/** Query keys for published content surfaces (shared by hooks + tests). */
export const contentQueryKeys = {
  all: ['content'] as const,
  clipsFeed: ['reels'] as const,
  flashFeed: ['content', 'posts', 'flash'] as const,
  storyTray: ['content', 'posts', 'story'] as const,
  profile: (type: PublisherProfileType, id: string) =>
    ['content', 'profile', type, id] as const,
  profilePosts: (type: PublisherProfileType, id: string, format: PublishFormat) =>
    ['content', 'profile', type, id, 'posts', format] as const,
  mine: ['content', 'mine'] as const,
};

export type InvalidateAfterPublishInput = {
  format: PublishFormat;
  publisherProfileId: string;
  publisherProfileType: PublisherProfileType;
};

/**
 * After a publish, refresh every surface that can show the new content:
 * the matching feed (Clips / Flash / Story tray), the publishing profile's
 * header counts and content tabs, and the owner's "My Content" list.
 */
export async function invalidateAfterPublish(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  input: InvalidateAfterPublishInput,
) {
  const feedKey =
    input.format === 'clip'
      ? contentQueryKeys.clipsFeed
      : input.format === 'flash'
        ? contentQueryKeys.flashFeed
        : contentQueryKeys.storyTray;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: feedKey }),
    queryClient.invalidateQueries({
      queryKey: contentQueryKeys.profile(
        input.publisherProfileType,
        input.publisherProfileId,
      ),
    }),
    queryClient.invalidateQueries({ queryKey: contentQueryKeys.mine }),
  ]);
}

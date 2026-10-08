import { contentQueryKeys, invalidateAfterPublish } from './contentQueryKeys';

function fakeClient() {
  const calls: unknown[][] = [];
  return {
    calls,
    invalidateQueries: jest.fn(async (filters: { queryKey: readonly unknown[] }) => {
      calls.push([...filters.queryKey]);
    }),
  };
}

const businessId = '22222222-2222-4222-8222-222222222222';

describe('invalidateAfterPublish', () => {
  it('refreshes the Clips feed, the business profile and My Content after a clip', async () => {
    const client = fakeClient();
    await invalidateAfterPublish(client as any, {
      format: 'clip',
      publisherProfileId: businessId,
      publisherProfileType: 'business',
    });
    expect(client.calls).toEqual([
      ['reels'],
      ['content', 'profile', 'business', businessId],
      ['content', 'mine'],
    ]);
  });

  it('refreshes the Flash feed after a Flash post', async () => {
    const client = fakeClient();
    await invalidateAfterPublish(client as any, {
      format: 'flash',
      publisherProfileId: businessId,
      publisherProfileType: 'business',
    });
    expect(client.calls[0]).toEqual([...contentQueryKeys.flashFeed]);
  });

  it('refreshes the Story tray after a Story', async () => {
    const client = fakeClient();
    await invalidateAfterPublish(client as any, {
      format: 'story',
      publisherProfileId: businessId,
      publisherProfileType: 'personal',
    });
    expect(client.calls[0]).toEqual([...contentQueryKeys.storyTray]);
    expect(client.calls[1]).toEqual(['content', 'profile', 'personal', businessId]);
  });

  it('profile post keys are prefixed by the profile key (one invalidation covers both)', () => {
    const profile = contentQueryKeys.profile('business', businessId);
    const posts = contentQueryKeys.profilePosts('business', businessId, 'clip');
    expect(posts.slice(0, profile.length)).toEqual([...profile]);
  });
});

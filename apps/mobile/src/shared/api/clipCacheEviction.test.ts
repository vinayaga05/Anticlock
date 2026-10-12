import { QueryClient } from '@tanstack/react-query';
import { evictDeletedClipFromCaches } from './clipCacheEviction';
import type { ReelItem } from '@/shared/types';

const reel = (id: string) => ({ id, videoUrl: `https://cdn.test/${id}.mp4` }) as ReelItem;

describe('evictDeletedClipFromCaches', () => {
  it('removes the deleted Clip from feed and profile Clip caches', async () => {
    const client = new QueryClient();
    const feedKey = ['reels', 'feed', 'content-first', 'api'];
    const profileKey = ['reels', 'profile', 'personal', 'u1'];
    client.setQueryData(feedKey, [reel('a'), reel('b')]);
    client.setQueryData(profileKey, [reel('b'), reel('c')]);
    client.setQueryData(['cms', 'banners', 'api'], [{ id: 'b' }]);

    await evictDeletedClipFromCaches(client, 'b');

    expect(client.getQueryData<ReelItem[]>(feedKey)?.map(r => r.id)).toEqual(['a']);
    expect(client.getQueryData<ReelItem[]>(profileKey)?.map(r => r.id)).toEqual(['c']);
    expect(client.getQueryData(['cms', 'banners', 'api'])).toEqual([{ id: 'b' }]);
    expect(client.getQueryState(profileKey)?.isInvalidated).toBe(true);
    client.clear();
  });
});

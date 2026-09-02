import { resultCardToNavigation } from '../navigation/assistantNavigation';

describe('assistantNavigation', () => {
  it('maps user cards to Profile route', () => {
    const nav = resultCardToNavigation({
      id: 'u1',
      type: 'user',
      title: 'Rahul',
      metadata: { userId: 'u1' },
    });
    expect(nav).toEqual({ route: 'Profile', params: { userId: 'u1' } });
  });

  it('maps reel cards to PlayFeed', () => {
    const nav = resultCardToNavigation({
      id: 'r1',
      type: 'reel',
      title: 'Travel reel',
      metadata: { reelId: 'r1' },
    });
    expect(nav?.route).toBe('Main');
    expect(nav?.params).toMatchObject({ screen: 'PlayFeed', reelId: 'r1' });
  });
});

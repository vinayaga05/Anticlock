import { normalizeHashtags, normalizeTaggedUserIds } from './clipComposerUtils';

describe('clip composer metadata', () => {
  it('normalizes and deduplicates hashtags', () => {
    expect(normalizeHashtags('#Fitness, wellness #FITNESS')).toEqual([
      'fitness',
      'wellness',
    ]);
  });

  it('rejects invalid hashtags', () => {
    expect(() => normalizeHashtags('#not-valid!')).toThrow(
      'not a valid hashtag',
    );
  });

  it('normalizes tagged user ids', () => {
    const userId = '2b7f9753-9cf5-43d8-910f-eec2b32e7398';
    expect(normalizeTaggedUserIds(`${userId}, ${userId}`)).toEqual([userId]);
  });
});

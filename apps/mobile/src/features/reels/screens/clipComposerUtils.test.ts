import {
  canCancelUpload,
  normalizeHashtags,
  normalizeTaggedUserIds,
  uploadProgressPercent,
} from './clipComposerUtils';

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

describe('clip upload progress', () => {
  it('maps the video transfer onto the main part of the bar', () => {
    expect(uploadProgressPercent('preparing')).toBe(5);
    expect(uploadProgressPercent('video', 0)).toBe(10);
    expect(uploadProgressPercent('video', 0.5)).toBe(43);
    expect(uploadProgressPercent('video', 1)).toBe(75);
    expect(uploadProgressPercent('cover', 1)).toBe(88);
    expect(uploadProgressPercent('publishing')).toBe(92);
    expect(uploadProgressPercent('complete')).toBe(100);
  });

  it('clamps bad fractions', () => {
    expect(uploadProgressPercent('video', 7)).toBe(75);
    expect(uploadProgressPercent('video', -1)).toBe(10);
    expect(uploadProgressPercent('video', Number.NaN)).toBe(10);
  });

  it('allows cancel only before publishing starts', () => {
    expect(canCancelUpload('preparing')).toBe(true);
    expect(canCancelUpload('video')).toBe(true);
    expect(canCancelUpload('cover')).toBe(true);
    expect(canCancelUpload('publishing')).toBe(false);
    expect(canCancelUpload('complete')).toBe(false);
    expect(canCancelUpload('idle')).toBe(false);
  });
});

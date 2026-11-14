import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ContentFeedItemSchema, ContentPostSchema } from '@anticlock/contracts';
import { resolveBusinessClipCtas, type BusinessClipPost } from './clipBusinessCta.js';

const BUSINESS = '9157c2d9-083f-42bc-a2a7-082a438082be';
const OTHER = '4aa0d726-0e04-4e6e-9f45-350fe8fb0e0a';
const VIDEO = '53ca5eeb-10c7-4949-8bfd-8bf8c1812940';
const PRODUCT = '727b3388-48de-4228-9e12-f845773614cb';
const POST = '36ba31d6-b9c2-4608-bf72-f3fbeac530e3';
const post = (overrides: Partial<BusinessClipPost> = {}): BusinessClipPost => ({ id: POST, format: 'clip', mediaType: 'video', authorProviderId: BUSINESS, mediaIds: [VIDEO], ...overrides });
const book = { entityType: 'provider', entityId: BUSINESS, ctaLabel: 'Book' };
const buy = { entityType: 'product', entityId: PRODUCT, ctaLabel: 'Buy' };

describe('business Clip actions', () => {
  it('gives every business video a Book action even without discovery metadata or a product', () => {
    const introOrIndividualProvider = { ...post(), businessId: null, providerId: null, serviceCategoryId: null, caption: 'Introduction' };
    assert.deepEqual(resolveBusinessClipCtas([introOrIndividualProvider], []).get(POST), book);
  });

  it('uses the real product associated with the same business video', () => {
    const links = [{ productId: PRODUCT, providerId: BUSINESS, mediaId: VIDEO }];
    assert.deepEqual(resolveBusinessClipCtas([post()], links).get(POST), buy);
  });

  it('does not use another business listing or an unrelated product media asset', () => {
    const links = [
      { productId: PRODUCT, providerId: OTHER, mediaId: VIDEO },
      { productId: PRODUCT, providerId: BUSINESS, mediaId: 'unrelated-video' },
      { productId: PRODUCT, providerId: null, mediaId: VIDEO },
    ];
    assert.deepEqual(resolveBusinessClipCtas([post()], links).get(POST), book);
  });

  it('falls back to Book when multiple eligible listings make the product ambiguous', () => {
    const links = [
      { productId: PRODUCT, providerId: BUSINESS, mediaId: VIDEO },
      { productId: 'another-product', providerId: BUSINESS, mediaId: VIDEO },
    ];
    assert.deepEqual(resolveBusinessClipCtas([post()], links).get(POST), book);
  });

  it('deduplicates repeated links to the same product', () => {
    const link = { productId: PRODUCT, providerId: BUSINESS, mediaId: VIDEO };
    assert.deepEqual(resolveBusinessClipCtas([post({ mediaIds: [VIDEO, VIDEO] })], [link, link]).get(POST), buy);
  });

  it('does not put commerce actions on personal Clips or non-Clip content', () => {
    const links = [{ productId: PRODUCT, providerId: BUSINESS, mediaId: VIDEO }];
    for (const item of [post({ authorProviderId: null }), post({ format: 'story' }), post({ format: 'flash' }), post({ mediaType: 'image' })]) {
      assert.equal(resolveBusinessClipCtas([item], links).get(POST), null);
    }
  });

  it('keeps per-business actions independent in a mixed batch', () => {
    const otherPost = post({ id: 'another-post', authorProviderId: OTHER });
    const result = resolveBusinessClipCtas([post(), otherPost], [{ productId: PRODUCT, providerId: BUSINESS, mediaId: VIDEO }]);
    assert.deepEqual(result.get(POST), buy);
    assert.deepEqual(result.get(otherPost.id), { entityType: 'provider', entityId: OTHER, ctaLabel: 'Book' });
  });

  it('keeps the optional nullable CTA in both profile-post and Clip-feed contracts', () => {
    const profilePost = {
      id: POST, format: 'clip', mediaType: 'video', caption: 'A business video', mediaIds: [VIDEO],
      thumbnailMediaId: null, hashtags: [], taggedUserIds: [], location: null, visibility: 'public',
      author: { type: 'provider', id: BUSINESS, name: 'Local business', avatarUrl: null },
      createdAt: '2026-11-14T08:00:00.000Z', expiresAt: null,
    };
    assert.equal(ContentPostSchema.safeParse(profilePost).success, true, 'older APIs may omit the new field');
    assert.equal(ContentPostSchema.parse({ ...profilePost, cta: null }).cta, null);
    assert.deepEqual(ContentPostSchema.parse({ ...profilePost, cta: buy }).cta, buy);
    const feed = ContentFeedItemSchema.parse({
      ...profilePost, cta: book, status: 'published', publishedAt: profilePost.createdAt,
      playbackUrl: 'https://media.example.test/video.mp4', posterUrl: null,
      duplicateClusterId: VIDEO, trendingScore: 0, viewerHasLiked: false,
    });
    assert.deepEqual(feed.cta, book);
  });
});

jest.mock('./client', () => ({ apiRequest: jest.fn(), ApiError: class extends Error {} }));
jest.mock('./config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/services/auth/authService', () => ({ readStoredSession: jest.fn() }));

import { mapApiContentClipToItem, mapApiProfileClipToItem, mapApiReelToItem, type ApiContentClipFeedItem } from './hooks';
import type { ApiContentPost } from '@/shared/publishing/contentPostMappers';
import { resolveClipCommerceAction } from '@/features/reels/feed/clipCommerce';

const publisher = { id: 'business-1', type: 'business' as const, displayName: 'Lotus Studio', handle: 'lotus', avatarUrl: null, verified: true, businessCategory: 'Fitness' };
const feed = (overrides: Partial<ApiContentClipFeedItem> = {}): ApiContentClipFeedItem => ({
  id: 'clip-1', format: 'clip', mediaType: 'video', status: 'published', visibility: 'public', caption: 'Our latest video', hashtags: [], taggedUserIds: [], location: null,
  duplicateClusterId: 'cluster-1', playbackUrl: 'https://cdn.test/video.mp4', posterUrl: null, likeCount: 0, commentCount: 0, viewCount: 0, viewerHasLiked: false, shareCount: 0,
  createdAt: '2026-11-14T12:00:00Z', publishedAt: '2026-11-14T12:00:00Z', publisherProfileId: publisher.id, publisherProfileType: 'business', publisher,
  author: { id: publisher.id, type: 'provider', name: publisher.displayName, avatarUrl: null }, providerId: publisher.id, businessId: null, ...overrides,
});
const profile = (overrides: Partial<ApiContentPost> = {}): ApiContentPost => ({
  id: 'clip-1', format: 'clip', mediaType: 'video', caption: 'Our latest video', mediaIds: ['video-1'], media: [{ id: 'video-1', kind: 'video', url: 'https://cdn.test/video.mp4' }],
  thumbnailMediaId: null, visibility: 'public', publisherProfileId: publisher.id, publisherProfileType: 'business', publisher,
  author: { id: publisher.id, type: 'provider', name: publisher.displayName, avatarUrl: null }, providerId: publisher.id, businessId: null,
  createdAt: '2026-11-14T12:00:00Z', expiresAt: null, ...overrides,
});

describe('business Clip commerce mapping', () => {
  test.each(['feed', 'profile'] as const)('%s keeps the real product destination and renders Buy', surface => {
    const cta = { entityType: 'product' as const, entityId: 'product-1', ctaLabel: 'Buy' };
    const item = surface === 'feed' ? mapApiContentClipToItem(feed({ cta })) : mapApiProfileClipToItem(profile({ cta }));
    expect(item?.bookTarget).toMatchObject({ entityType: 'product', entityId: 'product-1', cta: 'cart' });
    expect(resolveClipCommerceAction(item!)).toMatchObject({ label: 'Buy', destination: { screen: 'ProductDetail', params: { productId: 'product-1' } } });
  });

  test.each(['feed', 'profile'] as const)('%s keeps a provider destination and renders Book even without businessId/categoryId', surface => {
    const cta = { entityType: 'provider' as const, entityId: publisher.id, ctaLabel: 'Book' };
    const item = surface === 'feed' ? mapApiContentClipToItem(feed({ cta })) : mapApiProfileClipToItem(profile({ cta }));
    expect(resolveClipCommerceAction(item!)).toMatchObject({ label: 'Book', destination: { screen: 'BusinessProfile', params: { providerId: publisher.id } } });
  });

  test.each(['feed', 'profile'] as const)('%s retains Book for business clips from an older API without cta', surface => {
    const item = surface === 'feed' ? mapApiContentClipToItem(feed()) : mapApiProfileClipToItem(profile());
    expect(resolveClipCommerceAction(item!)).toMatchObject({ label: 'Book', destination: { screen: 'BusinessProfile', params: { providerId: publisher.id } } });
  });

  test.each(['feed', 'profile'] as const)('%s does not add business actions to personal videos', surface => {
    const personal = { ...publisher, id: 'person-1', type: 'personal' as const };
    const item = surface === 'feed' ? mapApiContentClipToItem(feed({ publisher: personal, publisherProfileType: 'personal', providerId: null })) : mapApiProfileClipToItem(profile({ publisher: personal, publisherProfileType: 'personal', providerId: null }));
    expect(resolveClipCommerceAction(item!)).toBeNull();
  });

  test('legacy Reel product CTA uses the same Buy destination', () => {
    const item = mapApiReelToItem({ id: 'reel-1', title: 'Product', creatorName: 'Store', category: null, caption: null, playbackUrl: 'https://cdn.test/video.mp4', posterUrl: null, likeCount: 0, commentCount: 0, saveCount: 0, cta: { entityType: 'product', entityId: 'real-product-id' } });
    expect(resolveClipCommerceAction(item)).toMatchObject({ label: 'Buy', destination: { screen: 'ProductDetail', params: { productId: 'real-product-id' } } });
  });

  test('a profile clip without the modern publisher block still uses its business author', () => {
    const item = mapApiProfileClipToItem(profile({ publisher: undefined, cta: null }));
    expect(resolveClipCommerceAction(item!)).toMatchObject({ label: 'Book', destination: { screen: 'BusinessProfile', params: { providerId: publisher.id } } });
  });
});

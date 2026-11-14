import type { ReelItem } from '@/shared/types';
import { resolveClipCommerceAction } from './clipCommerce';

function reel(overrides: Partial<ReelItem> = {}): ReelItem {
  return {
    id: 'clip-1', title: 'Original audio', author: 'A creator', caption: '',
    videoUrl: 'https://media.example.test/clip.mp4', posterUrl: '',
    likeCount: 0, commentCount: 0, feedSource: 'content_post', ...overrides,
  };
}
const business = { type: 'business' as const, id: 'business-1' };
const provider = (providerId = business.id, categoryId = '') => ({ screen: 'BusinessProfile', params: { providerId, ...(categoryId ? { categoryId } : {}) } });
const metadata: NonNullable<ReelItem['contentMetadata']> = {
  hashtags: [], taggedUserIds: [], location: null, visibility: 'public', duplicateClusterId: 'cluster-1',
  publishedAt: null, viewCount: 0, shareCount: 0, providerId: 'legacy-provider', businessId: null, serviceCategoryId: 'service-1',
};

describe('Clip commerce actions', () => {
  it('opens an explicitly linked product with Buy without changing the input or cart', () => {
    const target = Object.freeze({ entityType: 'product' as const, entityId: ' product-1 ', cta: 'book' as const });
    const item = Object.freeze(reel({ authorProfile: business, bookTarget: target }));
    expect(resolveClipCommerceAction(item)).toEqual({ label: 'Buy', icon: 'cart', destination: { screen: 'ProductDetail', params: { productId: 'product-1' } } });
    expect(item.bookTarget?.entityId).toBe(' product-1 ');
  });

  it.each([
    ['event', 'EventDetail', 'eventId'], ['course', 'CourseDetail', 'courseId'],
  ] as const)('opens a linked %s without requiring category metadata', (entityType, screen, parameter) => {
    expect(resolveClipCommerceAction(reel({ bookTarget: { entityType, entityId: 'linked-1', cta: 'cart' } }))).toEqual({
      label: 'Book', icon: 'calendar', destination: { screen, params: { [parameter]: 'linked-1' } },
    });
  });

  it('retains the trip icon while using the concise Book label', () => {
    expect(resolveClipCommerceAction(reel({ bookTarget: { entityType: 'event', entityId: 'trip-1', cta: 'trip' } }))).toEqual({
      label: 'Book', icon: 'globe', destination: { screen: 'EventDetail', params: { eventId: 'trip-1' } },
    });
  });

  it('opens a provider with its category, and never interprets its cart hint as a product', () => {
    expect(resolveClipCommerceAction(reel({ bookTarget: { entityType: 'provider', entityId: 'provider-1', categoryId: ' service-1 ', cta: 'cart' } }))).toEqual({
      label: 'Book', icon: 'calendar', destination: { screen: 'BusinessProfile', params: { providerId: 'provider-1', categoryId: 'service-1' } },
    });
  });

  it('opens the booking-capable provider detail when its category is missing', () => {
    expect(resolveClipCommerceAction(reel({ authorProfile: business, bookTarget: { entityType: 'provider', entityId: 'provider-1', categoryId: ' ' } }))).toEqual({ label: 'Book', icon: 'calendar', destination: provider('provider-1') });
  });

  it('uses structured category metadata for a provider with no target category', () => {
    expect(resolveClipCommerceAction(reel({ contentMetadata: metadata, bookTarget: { entityType: 'provider', entityId: 'provider-1' } }))).toEqual({ label: 'Book', icon: 'calendar', destination: provider('provider-1', 'service-1') });
  });

  it('falls back to the canonical business author even with no businessId metadata', () => {
    expect(resolveClipCommerceAction(reel({ authorProfile: business, contentMetadata: metadata }))).toEqual({ label: 'Book', icon: 'calendar', destination: provider('business-1', 'service-1') });
  });

  it('prefers an explicit target category when falling back to business booking details', () => {
    expect(resolveClipCommerceAction(reel({ authorProfile: business, contentMetadata: metadata, bookTarget: { entityType: 'provider', categoryId: ' target-service ' } }))).toEqual({ label: 'Book', icon: 'calendar', destination: provider('business-1', 'target-service') });
  });

  it('retains complete legacy service-category navigation', () => {
    expect(resolveClipCommerceAction(reel({ bookTarget: { serviceCategoryId: ' category-1 ', serviceTreeId: ' tree-1 ', cta: 'book' } }))).toEqual({
      label: 'Book', icon: 'calendar', destination: { screen: 'ServiceCategory', params: { categoryId: 'category-1', treeId: 'tree-1' } },
    });
  });

  it.each([
    ['doctor', 'DoctorProfile', 'doctorId'], ['lab', 'LabDetail', 'labId'], ['fitness', 'ClassDetail', 'classId'],
  ] as const)('retains a legacy %s destination', (kind, screen, parameter) => {
    expect(resolveClipCommerceAction(reel({ bookTarget: { kind, id: 'legacy-1' } }))).toEqual({ label: 'Book', icon: 'calendar', destination: { screen, params: { [parameter]: 'legacy-1' } } });
  });

  it('uses Shop only for legacy cart hints without an explicit product link', () => {
    for (const target of [{ cta: 'cart' as const }, { cta: 'cart' as const, entityId: 'untyped-id' }]) {
      expect(resolveClipCommerceAction(reel({ bookTarget: target }))).toEqual({ label: 'Buy', icon: 'cart', destination: { screen: 'Main', params: { screen: 'Shop' } } });
    }
  });

  it.each([
    undefined, {}, { cta: 'book' }, { entityType: 'product', entityId: '' },
    { entityType: 'product', entityId: ' ', cta: 'cart' },
    { entityType: 'event' }, { entityType: 'provider' },
    { serviceCategoryId: 'category-1' }, { serviceTreeId: 'tree-1' },
    { kind: 'doctor' }, { kind: 'fitness', id: ' ' },
  ] as const)('falls back to business booking details for incomplete targets %#', target => {
    expect(resolveClipCommerceAction(reel({ authorProfile: business, bookTarget: target }))).toEqual({ label: 'Book', icon: 'calendar', destination: provider() });
    expect(resolveClipCommerceAction(reel({ authorProfile: { type: 'user', id: 'user-1' }, bookTarget: target }))).toBeNull();
  });

  it('ignores captions and category words when choosing commerce actions', () => {
    const item = reel({ title: 'Buy our product', caption: '#products #book #doctor', author: 'shop.provider' });
    expect(resolveClipCommerceAction(item)).toBeNull();
    expect(resolveClipCommerceAction({ ...item, authorProfile: business })).toEqual({ label: 'Book', icon: 'calendar', destination: provider() });
  });

  it('does not emit a destination for an empty business identity or unknown legacy kind', () => {
    expect(resolveClipCommerceAction(reel({ authorProfile: { type: 'business', id: ' ' } }))).toBeNull();
    expect(resolveClipCommerceAction(reel({ bookTarget: { kind: 'unknown', id: 'legacy-1' } as any }))).toBeNull();
  });
});

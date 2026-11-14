import type { ReelItem } from '@/shared/types';
import type { RootStackParamList } from '@/shared/navigation/types';

type CommerceScreen =
  | 'ProductDetail' | 'EventDetail' | 'CourseDetail' | 'BusinessProfile'
  | 'ServiceCategory' | 'DoctorProfile' | 'LabDetail'
  | 'ClassDetail' | 'Main';

export type ClipCommerceDestination = {
  [Screen in CommerceScreen]: {
    screen: Screen;
    params: Exclude<RootStackParamList[Screen], undefined>;
  };
}[CommerceScreen];

export type ClipCommerceAction = {
  label: 'Buy' | 'Book';
  icon: 'cart' | 'calendar' | 'globe';
  destination: ClipCommerceDestination;
};

const id = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const book = (destination: ClipCommerceDestination, icon: 'calendar' | 'globe' = 'calendar'): ClipCommerceAction => ({ label: 'Book', icon, destination });
const buy = (destination: ClipCommerceDestination): ClipCommerceAction => ({ label: 'Buy', icon: 'cart', destination });
const providerDetail = (entityId: string, categoryId: string): ClipCommerceDestination => ({
  screen: 'BusinessProfile', params: { providerId: entityId, ...(categoryId ? { categoryId } : {}) },
});

/** Resolve a complete navigation action from structured Clip metadata only. */
export function resolveClipCommerceAction(reel: ReelItem): ClipCommerceAction | null {
  const target = reel.bookTarget;
  const providerCategoryId = id(target?.categoryId) || id(reel.contentMetadata?.serviceCategoryId);
  if (target) {
    const entityId = id(target.entityId);
    if (target.entityType && entityId) {
      if (target.entityType === 'product') {
        return buy({ screen: 'ProductDetail', params: { productId: entityId } });
      }
      if (target.entityType === 'event') {
        return book({ screen: 'EventDetail', params: { eventId: entityId } }, target.cta === 'trip' ? 'globe' : 'calendar');
      }
      if (target.entityType === 'course') {
        return book({ screen: 'CourseDetail', params: { courseId: entityId } });
      }
      if (target.entityType === 'provider') {
        return book(providerDetail(entityId, providerCategoryId));
      }
    }
    // Legacy category and clinical targets have their own complete shapes.
    // A malformed explicit entity must not be mistaken for a legacy product.
    if (!target.entityType) {
      const categoryId = id(target.serviceCategoryId);
      const treeId = id(target.serviceTreeId);
      if (categoryId && treeId) {
        return book({ screen: 'ServiceCategory', params: { categoryId, treeId } }, target.cta === 'trip' ? 'globe' : 'calendar');
      }
      const legacyId = id(target.id);
      if (legacyId && target.kind === 'doctor') return book({ screen: 'DoctorProfile', params: { doctorId: legacyId } });
      if (legacyId && target.kind === 'lab') return book({ screen: 'LabDetail', params: { labId: legacyId } });
      if (legacyId && target.kind === 'fitness') return book({ screen: 'ClassDetail', params: { classId: legacyId } });
      if (target.cta === 'cart' && !target.kind && !legacyId && !categoryId && !treeId) {
        // A legacy cart hint does not identify a purchasable product/variant.
        return buy({ screen: 'Main', params: { screen: 'Shop' } });
      }
    }
  }
  const authorId = id(reel.authorProfile?.id);
  return reel.authorProfile?.type === 'business' && authorId
    ? book(providerDetail(authorId, providerCategoryId))
    : null;
}

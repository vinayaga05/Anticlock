import { serviceCategories } from './serviceCategories';
import { serviceTrees } from './serviceTrees';
import {
  marketplaceCourses,
  marketplaceEvents,
  marketplaceProducts,
  marketplaceProviders,
  serviceRequests,
  universalBookings,
} from './providers';
import {
  CtaConfig,
  MarketplaceCourse,
  MarketplaceEvent,
  MarketplaceProduct,
  MarketplaceProvider,
  ServiceActionType,
  ServiceCategory,
  ServiceTree,
  ServiceTreeId,
} from './serviceTypes';

export function getTrees(): ServiceTree[] {
  return serviceTrees;
}

export function getTree(treeId: ServiceTreeId): ServiceTree | undefined {
  return serviceTrees.find(t => t.id === treeId);
}

export function getCategoriesByTree(treeId: ServiceTreeId): ServiceCategory[] {
  return serviceCategories
    .filter(c => c.treeId === treeId)
    .sort((a, b) => a.order - b.order);
}

export function getCategory(categoryId: string): ServiceCategory | undefined {
  return serviceCategories.find(c => c.id === categoryId);
}

export function getAllCategories(): ServiceCategory[] {
  return serviceCategories;
}

export function getProvidersForCategory(
  categoryId: string,
): MarketplaceProvider[] {
  const matched = marketplaceProviders.filter(p =>
    p.categoryIds.includes(categoryId),
  );
  if (matched.length > 0) return matched;

  const category = getCategory(categoryId);
  if (!category) return [];

  return marketplaceProviders.filter(p => p.actionType === category.actionType);
}

export function getProvider(
  providerId: string,
): MarketplaceProvider | undefined {
  return marketplaceProviders.find(p => p.id === providerId);
}

export function getEventsForCategory(categoryId: string): MarketplaceEvent[] {
  const direct = marketplaceEvents.filter(e => e.categoryId === categoryId);
  if (direct.length) return direct;
  const category = getCategory(categoryId);
  if (
    category?.actionType === 'event_booking' ||
    category?.actionType === 'transport_booking'
  ) {
    return marketplaceEvents;
  }
  return [];
}

export function getEvent(eventId: string): MarketplaceEvent | undefined {
  return marketplaceEvents.find(e => e.id === eventId);
}

export function getCoursesForCategory(categoryId: string): MarketplaceCourse[] {
  const direct = marketplaceCourses.filter(c => c.categoryId === categoryId);
  if (direct.length) return direct;
  const category = getCategory(categoryId);
  if (category?.actionType === 'course_enrollment') return marketplaceCourses;
  return [];
}

export function getCourse(courseId: string): MarketplaceCourse | undefined {
  return marketplaceCourses.find(c => c.id === courseId);
}

export function getProductsForCategory(
  categoryId: string,
): MarketplaceProduct[] {
  const direct = marketplaceProducts.filter(p => p.categoryId === categoryId);
  if (direct.length) return direct;
  const category = getCategory(categoryId);
  if (
    category?.actionType === 'product_purchase' ||
    category?.actionType === 'property_enquiry'
  ) {
    return marketplaceProducts.filter(p =>
      category.actionType === 'property_enquiry' ? p.isProperty : !p.isProperty,
    );
  }
  return [];
}

export function getProduct(productId: string): MarketplaceProduct | undefined {
  return marketplaceProducts.find(p => p.id === productId);
}

export function resolvePrimaryCta(actionType: ServiceActionType): CtaConfig {
  switch (actionType) {
    case 'appointment':
      return {
        label: 'Book appointment',
        icon: 'calendar',
        action: 'schedule',
      };
    case 'class_booking':
      return { label: 'Book class', icon: 'calendar', action: 'schedule' };
    case 'membership':
      return {
        label: 'View memberships',
        icon: 'clipboard',
        action: 'membership',
      };
    case 'event_booking':
      return { label: 'Book trip', icon: 'globe', action: 'event_book' };
    case 'transport_booking':
      return { label: 'Book transport', icon: 'truck', action: 'event_book' };
    case 'home_service':
    case 'service_request':
      return { label: 'Request service', icon: 'clipboard', action: 'request' };
    case 'course_enrollment':
      return { label: 'Enroll now', icon: 'clipboard', action: 'enroll' };
    case 'product_purchase':
      return { label: 'Add to cart', icon: 'cart', action: 'cart' };
    case 'property_enquiry':
      return { label: 'Contact seller', icon: 'messages', action: 'enquiry' };
    default:
      return { label: 'Continue', icon: 'chevron-right', action: 'schedule' };
  }
}

export function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      categories: serviceCategories.slice(0, 8),
      providers: marketplaceProviders.slice(0, 6),
      products: marketplaceProducts.slice(0, 6),
      events: marketplaceEvents.slice(0, 4),
      courses: marketplaceCourses.slice(0, 4),
    };
  }

  const matches = (...values: Array<string | undefined>) =>
    values.some(value => value?.toLowerCase().includes(q));
  const categoryContext = (categoryId: string) => {
    const category = getCategory(categoryId);
    const tree = category ? getTree(category.treeId) : undefined;
    return [category?.name, category?.description, tree?.name];
  };

  return {
    categories: serviceCategories.filter(category =>
      matches(
        category.name,
        category.description,
        getTree(category.treeId)?.name,
      ),
    ),
    providers: marketplaceProviders.filter(provider =>
      matches(
        provider.name,
        provider.type,
        provider.subtitle,
        ...provider.categoryIds.flatMap(categoryContext),
      ),
    ),
    products: marketplaceProducts.filter(product =>
      matches(
        product.name,
        product.description,
        ...categoryContext(product.categoryId),
      ),
    ),
    events: marketplaceEvents.filter(event =>
      matches(
        event.title,
        event.destination,
        event.organizer,
        ...categoryContext(event.categoryId),
      ),
    ),
    courses: marketplaceCourses.filter(course =>
      matches(
        course.title,
        course.instructor,
        course.level,
        ...categoryContext(course.categoryId),
      ),
    ),
  };
}

export function getUniversalBookings() {
  return universalBookings;
}

export function getServiceRequests() {
  return serviceRequests;
}

export function getEcommerceCategories() {
  return getCategoriesByTree('ecommerce');
}

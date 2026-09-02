import type { NavigationCatalogItem } from '@anticlock/contracts';

export const NAVIGATION_CATALOG: NavigationCatalogItem[] = [
  {
    id: 'user_profile',
    name: 'User Profile',
    aliases: ['profile', 'user page', 'account', 'my profile'],
    route: 'Profile',
    paramsSchema: { userId: 'string' },
    description: 'View a user profile and posts',
    permissions: ['authenticated'],
    examples: ["Open Rahul's profile", 'Show me my profile'],
  },
  {
    id: 'saved_posts',
    name: 'Saved Posts',
    aliases: ['bookmarks', 'saved content', 'my saves', 'saved hub'],
    route: 'SavedHub',
    description: 'View posts you have saved',
    permissions: ['authenticated'],
    examples: ['Take me to saved posts', 'Show my bookmarks'],
  },
  {
    id: 'search',
    name: 'Search',
    aliases: ['find', 'search services', 'look up'],
    route: 'Search',
    description: 'Search services, doctors, and products',
    permissions: ['authenticated', 'guest'],
    examples: ['Open search', 'I want to search for doctors'],
  },
  {
    id: 'reels_feed',
    name: 'Reels Feed',
    aliases: ['reels', 'play feed', 'watch reels', 'clips'],
    route: 'Main',
    paramsSchema: { screen: 'PlayFeed' },
    description: 'Browse the reels feed',
    permissions: ['authenticated', 'guest'],
    examples: ['Show me reels', 'Open the play feed'],
  },
  {
    id: 'my_bookings',
    name: 'My Bookings',
    aliases: ['bookings', 'appointments', 'my appointments'],
    route: 'MyBookings',
    description: 'View your bookings and appointments',
    permissions: ['authenticated'],
    examples: ['Show my bookings', 'Open appointments'],
  },
  {
    id: 'my_orders',
    name: 'My Orders',
    aliases: ['orders', 'purchases', 'my purchases'],
    route: 'MyOrders',
    description: 'View your order history',
    permissions: ['authenticated'],
    examples: ['Show my orders', 'Where are my purchases'],
  },
  {
    id: 'service_tree',
    name: 'Service Category Tree',
    aliases: ['services', 'service tree', 'browse services'],
    route: 'ServiceTree',
    paramsSchema: { treeId: 'string' },
    description: 'Browse a service category tree',
    permissions: ['authenticated', 'guest'],
    examples: ['Show health services', 'Open wellness services'],
  },
  {
    id: 'service_category',
    name: 'Service Category',
    aliases: ['category', 'subcategory'],
    route: 'ServiceCategory',
    paramsSchema: { treeId: 'string', categoryId: 'string' },
    description: 'Browse providers in a service category',
    permissions: ['authenticated', 'guest'],
    examples: ['Show dentists in Chennai'],
  },
  {
    id: 'universal_detail',
    name: 'Provider or Content Detail',
    aliases: ['provider detail', 'course detail', 'event detail', 'product detail'],
    route: 'UniversalDetail',
    paramsSchema: {
      entityType: 'string',
      entityId: 'string',
      categoryId: 'string',
    },
    description: 'Open a provider, course, event, or product detail page',
    permissions: ['authenticated', 'guest'],
    examples: ['Open this provider', 'Show course details'],
  },
  {
    id: 'inbox',
    name: 'Knock Inbox',
    aliases: ['messages', 'inbox', 'notifications', 'knock'],
    route: 'Inbox',
    description: 'Open notifications, bookings, and chat inbox',
    permissions: ['authenticated'],
    examples: ['Open my messages', 'Show notifications'],
  },
  {
    id: 'account_settings',
    name: 'Account Settings',
    aliases: ['settings', 'preferences', 'account'],
    route: 'AccountSettings',
    description: 'Manage account and Genie privacy settings',
    permissions: ['authenticated'],
    examples: ['Open settings', 'Account preferences'],
  },
  {
    id: 'provider_dashboard',
    name: 'Provider Dashboard',
    aliases: ['provider portal', 'my provider dashboard'],
    route: 'ProviderDashboard',
    description: 'Provider management dashboard',
    permissions: ['authenticated'],
    examples: ['Open provider dashboard'],
  },
];

export function findCatalogItem(query: string): NavigationCatalogItem | null {
  const normalized = query.toLowerCase().trim();
  return (
    NAVIGATION_CATALOG.find(
      item =>
        item.id === normalized ||
        item.name.toLowerCase() === normalized ||
        item.route.toLowerCase() === normalized ||
        item.aliases.some(a => a.toLowerCase() === normalized),
    ) ?? null
  );
}

export function validateNavigation(
  route: string,
  params: Record<string, unknown>,
  isAuthenticated: boolean,
): { ok: true; item: NavigationCatalogItem } | { ok: false; error: string; code: string } {
  const item = NAVIGATION_CATALOG.find(c => c.route === route);
  if (!item) {
    return { ok: false, error: `Unknown route: ${route}`, code: 'invalid_route' };
  }

  const authOnly =
    item.permissions.includes('authenticated') &&
    !item.permissions.includes('guest');
  if (authOnly && !isAuthenticated) {
    return { ok: false, error: 'Sign in required for this screen', code: 'auth_required' };
  }

  if (item.paramsSchema) {
    for (const [key, type] of Object.entries(item.paramsSchema)) {
      const value = params[key];
      if (value === undefined || value === null) {
        if (key === 'userId' && route === 'Profile') continue;
        if (key === 'screen' && route === 'Main') continue;
        return { ok: false, error: `Missing required param: ${key}`, code: 'invalid_params' };
      }
      if (type === 'string' && typeof value !== 'string') {
        return { ok: false, error: `Param ${key} must be a string`, code: 'invalid_params' };
      }
    }
  }

  return { ok: true, item };
}

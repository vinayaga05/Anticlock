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
    description: 'Browse the reels / clips feed',
    permissions: ['authenticated', 'guest'],
    examples: ['Show me reels', 'Open the play feed'],
  },
  {
    id: 'shop',
    name: 'Shop',
    aliases: ['shop', 'store', 'marketplace', 'ecommerce', 'buy'],
    route: 'Main',
    paramsSchema: { screen: 'Shop' },
    description: 'Open the Shop tab to browse products',
    permissions: ['authenticated', 'guest'],
    examples: ['Take me to shop', 'Open the store', 'Go to marketplace'],
  },
  {
    id: 'flash_feed',
    name: 'Flash',
    aliases: ['flash', 'stories', 'flash feed'],
    route: 'Main',
    paramsSchema: { screen: 'Flash' },
    description: 'Open the Flash feed',
    permissions: ['authenticated', 'guest'],
    examples: ['Open flash', 'Show flash feed'],
  },
  {
    id: 'needs',
    name: 'Needs',
    aliases: ['needs', 'services home', 'what i need'],
    route: 'Main',
    paramsSchema: { screen: 'Needs' },
    description: 'Open the Needs tab for lifestyle services',
    permissions: ['authenticated', 'guest'],
    examples: ['Open needs', 'Take me to needs'],
  },
  {
    id: 'community',
    name: 'Community',
    aliases: ['community', 'communities', 'groups'],
    route: 'Main',
    paramsSchema: { screen: 'Community' },
    description: 'Open the Community tab',
    permissions: ['authenticated', 'guest'],
    examples: ['Open community', 'Show communities'],
  },
  {
    id: 'knock_tab',
    name: 'Knock',
    aliases: ['knock tab', 'knock screen'],
    route: 'Main',
    paramsSchema: { screen: 'Knock' },
    description: 'Open the Knock tab (messages hub)',
    permissions: ['authenticated', 'guest'],
    examples: ['Open knock'],
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

function resolveCatalogItem(
  route: string,
  params: Record<string, unknown>,
): NavigationCatalogItem | null {
  const candidates = NAVIGATION_CATALOG.filter(c => c.route === route);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;

  const screen = params.screen;
  if (typeof screen === 'string') {
    const byScreen = candidates.find(c => c.paramsSchema?.screen === screen);
    if (byScreen) return byScreen;
  }

  return candidates[0] ?? null;
}

export function validateNavigation(
  route: string,
  params: Record<string, unknown>,
  isAuthenticated: boolean,
): { ok: true; item: NavigationCatalogItem } | { ok: false; error: string; code: string } {
  // Allow "Shop" / "PlayFeed" style shortcuts → Main + screen
  const mainTab = NAVIGATION_CATALOG.find(
    c =>
      c.route === 'Main' &&
      typeof c.paramsSchema?.screen === 'string' &&
      c.paramsSchema.screen === route,
  );
  const resolvedRoute = mainTab ? 'Main' : route;
  const resolvedParams =
    mainTab && !params.screen
      ? { ...params, screen: mainTab.paramsSchema!.screen }
      : params;

  const item = resolveCatalogItem(resolvedRoute, resolvedParams);
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
    for (const [key, expected] of Object.entries(item.paramsSchema)) {
      const value = resolvedParams[key];
      if (value === undefined || value === null) {
        if (key === 'userId' && resolvedRoute === 'Profile') continue;
        // Literal screen defaults (e.g. screen: 'Shop') are filled by the tool layer
        if (expected !== 'string') {
          resolvedParams[key] = expected;
          continue;
        }
        return { ok: false, error: `Missing required param: ${key}`, code: 'invalid_params' };
      }
      if (expected === 'string') {
        if (typeof value !== 'string') {
          return { ok: false, error: `Param ${key} must be a string`, code: 'invalid_params' };
        }
      } else if (value !== expected) {
        return {
          ok: false,
          error: `Param ${key} must be ${expected}`,
          code: 'invalid_params',
        };
      }
    }
  }

  return { ok: true, item };
}

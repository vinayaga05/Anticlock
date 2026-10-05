/**
 * Mock app screenshots configuration
 * 
 * These are creative mockups to be replaced with real screenshots later.
 * To swap: place actual screenshots in public/screens/ with matching filenames
 * (e.g., home.png, clips.png, etc.) and they will override these mockups.
 */

export interface ScreenConfig {
  id: string;
  name: string;
  mockComponent: string;
  screenshotPath?: string;
}

export const appScreens: ScreenConfig[] = [
  {
    id: 'home',
    name: 'Home Feed',
    mockComponent: 'HomeScreen',
    screenshotPath: '/screens/home.png',
  },
  {
    id: 'clips',
    name: 'Clips Feed',
    mockComponent: 'ClipsScreen',
    screenshotPath: '/screens/clips.png',
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    mockComponent: 'MarketplaceScreen',
    screenshotPath: '/screens/marketplace.png',
  },
  {
    id: 'booking',
    name: 'Booking Confirmation',
    mockComponent: 'BookingScreen',
    screenshotPath: '/screens/booking.png',
  },
  {
    id: 'community',
    name: 'Community Feed',
    mockComponent: 'CommunityScreen',
    screenshotPath: '/screens/community.png',
  },
  {
    id: 'messages',
    name: 'Messages',
    mockComponent: 'MessagesScreen',
    screenshotPath: '/screens/messages.png',
  },
  {
    id: 'provider',
    name: 'Provider Dashboard',
    mockComponent: 'ProviderScreen',
    screenshotPath: '/screens/provider.png',
  },
];

export function useScreenshot(screenId: string): string | null {
  // In production, check if real screenshot exists, otherwise use mock
  const screen = appScreens.find(s => s.id === screenId);
  return screen?.screenshotPath || null;
}

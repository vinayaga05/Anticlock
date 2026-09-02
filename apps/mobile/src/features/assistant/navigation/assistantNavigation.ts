import type { AssistantResultCard } from '@/features/assistant/types';

export function executeAssistantNavigation(
  navigation: { navigate: (route: string, params?: object) => void },
  route: string,
  params: Record<string, unknown>,
) {
  if (route === 'Main' && params.screen) {
    navigation.navigate('Main', {
      screen: params.screen as string,
      ...(params.reelId ? { params: { reelId: params.reelId } } : {}),
    });
    return;
  }

  navigation.navigate(route, params as object);
}

export function resultCardToNavigation(
  card: AssistantResultCard,
): { route: string; params: Record<string, unknown> } | null {
  if (card.type === 'user') {
    return {
      route: 'Profile',
      params: { userId: String(card.metadata?.userId ?? card.id) },
    };
  }
  if (card.type === 'reel' || card.type === 'post') {
    return {
      route: 'Main',
      params: { screen: 'PlayFeed', reelId: String(card.metadata?.reelId ?? card.id) },
    };
  }
  if (card.type === 'catalog') {
    if (card.metadata?.kind === 'tree') {
      return { route: 'ServiceTree', params: { treeId: card.id } };
    }
    return {
      route: 'ServiceCategory',
      params: {
        treeId: String(card.metadata?.treeId ?? ''),
        categoryId: card.id,
      },
    };
  }
  return null;
}

export const assistantLinking = {
  prefixes: ['anticlock://'],
  config: {
    screens: {
      Profile: 'profile/:userId?',
      SavedHub: 'saved',
      Search: 'search',
      MyBookings: 'bookings',
      MyOrders: 'orders',
      Inbox: 'inbox',
      AccountSettings: 'settings',
      ServiceTree: 'services/:treeId',
      ServiceCategory: 'services/:treeId/category/:categoryId',
      ProviderDashboard: 'provider',
      Main: {
        screens: {
          PlayFeed: 'reels',
          Shop: 'shop',
          Community: 'community',
          Knock: 'knock',
          Needs: 'needs',
          Flash: 'flash',
        },
      },
    },
  },
};

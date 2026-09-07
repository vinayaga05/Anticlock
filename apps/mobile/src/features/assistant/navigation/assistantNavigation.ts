import type { GenieAction } from '@anticlock/contracts';
import type { AssistantResultCard } from '@/features/assistant/types';

export type GenieNavigation = {
  navigate: (route: string, params?: object) => void;
};

export type GenieActionHandlers = {
  onRequestLocation?: (purpose: string, actionId: string) => void;
  onConfirmMutation?: (operation: string, preview: Record<string, unknown>) => void;
};

const executedActionIds = new Set<string>();

/** Prevent duplicate execution when streams reconnect or replay events. */
export function resetGenieActionDedupe() {
  executedActionIds.clear();
}

export function executeAssistantNavigation(
  navigation: GenieNavigation,
  route: string,
  params: Record<string, unknown>,
) {
  if (route === 'Main' && params.screen) {
    const tabParams: Record<string, unknown> = {};
    if (params.reelId) tabParams.reelId = params.reelId;
    if (params.q) tabParams.q = params.q;
    if (params.categoryId) tabParams.categoryId = params.categoryId;
    navigation.navigate('Main', {
      screen: params.screen as string,
      ...(Object.keys(tabParams).length ? { params: tabParams } : {}),
    });
    return;
  }

  navigation.navigate(route, params as object);
}

export function executeGenieAction(
  navigation: GenieNavigation,
  action: GenieAction,
  handlers: GenieActionHandlers = {},
): { ok: boolean; reason?: string } {
  if (executedActionIds.has(action.id)) {
    return { ok: false, reason: 'duplicate' };
  }
  executedActionIds.add(action.id);

  switch (action.type) {
    case 'navigate':
      executeAssistantNavigation(
        navigation,
        action.target.route,
        action.target.params ?? {},
      );
      return { ok: true };
    case 'open_search_results': {
      const filters = action.filters ?? {};
      if (action.domain === 'services') {
        const treeId = String(filters.treeId ?? '');
        const categoryId = String(filters.categoryId ?? '');
        if (treeId && categoryId) {
          executeAssistantNavigation(navigation, 'ServiceCategory', {
            treeId,
            categoryId,
            ...(filters.q ? { q: filters.q } : {}),
            ...(filters.areaLabel ? { areaLabel: filters.areaLabel } : {}),
          });
          return { ok: true };
        }
        executeAssistantNavigation(navigation, 'Main', { screen: 'Needs' });
        return { ok: true };
      }
      if (action.domain === 'clips') {
        executeAssistantNavigation(navigation, 'Main', {
          screen: 'PlayFeed',
          ...(filters.q ? { q: filters.q } : {}),
          ...(filters.reelId ? { reelId: filters.reelId } : {}),
        });
        return { ok: true };
      }
      if (action.domain === 'shop') {
        executeAssistantNavigation(navigation, 'Main', {
          screen: 'Shop',
          ...(filters.q ? { q: filters.q } : {}),
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        });
        return { ok: true };
      }
      if (action.domain === 'flash') {
        executeAssistantNavigation(navigation, 'Main', { screen: 'Flash' });
        return { ok: true };
      }
      if (action.domain === 'needs') {
        executeAssistantNavigation(navigation, 'Main', { screen: 'Needs' });
        return { ok: true };
      }
      if (action.domain === 'community') {
        executeAssistantNavigation(navigation, 'Main', { screen: 'Community' });
        return { ok: true };
      }
      if (action.domain === 'knock') {
        executeAssistantNavigation(navigation, 'Main', { screen: 'Knock' });
        return { ok: true };
      }
      return { ok: false, reason: 'unsupported_domain' };
    }
    case 'request_location':
      handlers.onRequestLocation?.(action.purpose, action.id);
      return { ok: true };
    case 'confirm_mutation':
      // A confirmation action is never permission to mutate by itself. The
      // caller must install a concrete, server-backed confirmation handler.
      if (!handlers.onConfirmMutation) {
        return { ok: false, reason: 'confirmation_handler_missing' };
      }
      handlers.onConfirmMutation(action.operation, action.preview ?? {});
      return { ok: true };
    default:
      return { ok: false, reason: 'unknown_action' };
  }
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

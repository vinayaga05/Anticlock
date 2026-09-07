import { useCallback, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { apiStream, ApiError } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { createAnalyticsEventId } from '@/shared/api/reelAnalytics';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import type { AssistantStreamEvent } from '@/features/assistant/types';
import {
  executeAssistantNavigation,
  executeGenieAction,
  resetGenieActionDedupe,
} from '@/features/assistant/navigation/assistantNavigation';
import {
  getDefaultAreaLabel,
  resolveGenieLocation,
  type GenieLocationContext,
} from '@/features/assistant/services/genieLocation';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Must be a UUID — API schema validates `clientRequestId` with z.string().uuid(). */
function newRequestId() {
  return createAnalyticsEventId();
}

async function requestDeviceLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location for Genie',
        message: 'Genie uses your location only when you ask for things near you.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: without a geolocation native module, we cannot prompt — fall back to typed area.
  return false;
}

export function useAssistantChat(navigation: {
  navigate: (route: string, params?: object) => void;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const locationCtxRef = useRef<GenieLocationContext>({});

  const trackAnalytics = useCallback(
    async (conversationId: string | undefined, event: Record<string, unknown>) => {
      if (!isApiEnabled) return;
      try {
        const { apiRequest } = await import('@/shared/api/client');
        await apiRequest('/v1/assistant/analytics', {
          method: 'POST',
          body: JSON.stringify({ conversationId, event }),
        });
      } catch {
        /* non-blocking */
      }
    },
    [],
  );

  const trackBehavior = useCallback(async (event: Record<string, unknown>) => {
    if (!isApiEnabled) return;
    try {
      const { apiRequest } = await import('@/shared/api/client');
      await apiRequest('/v1/assistant/behavior-events', {
        method: 'POST',
        body: JSON.stringify(event),
      });
    } catch {
      /* non-blocking */
    }
  }, []);

  const handleRequestLocation = useCallback(
    async (purpose: string, _actionId: string) => {
      Alert.alert(
        'Use your location?',
        purpose || 'Genie needs your location to show nearby results.',
        [
          {
            text: 'Type an area instead',
            style: 'cancel',
            onPress: () => {
              useAssistantStore.getState().updateLastAssistant({
                content:
                  'No problem — tell me a city, area, or PIN (for example “Anna Nagar” or “Chennai”).',
                pending: false,
              });
            },
          },
          {
            text: 'Allow',
            onPress: () => {
              void (async () => {
                const granted = await requestDeviceLocationPermission();
                if (!granted) {
                  useAssistantStore.getState().updateLastAssistant({
                    content:
                      'Location access was denied. Tell me an area to search, or browse without location.',
                    pending: false,
                  });
                  return;
                }
                locationCtxRef.current = {
                  ...locationCtxRef.current,
                  deviceLabel: getDefaultAreaLabel(),
                };
                useAssistantStore.getState().updateLastAssistant({
                  content: `Got it — using ${getDefaultAreaLabel()}. Ask me again and I’ll continue.`,
                  pending: false,
                });
              })();
            },
          },
        ],
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const store = useAssistantStore.getState();
      if (!store.enabled) return;

      const trimmed = text.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const clientRequestId = newRequestId();
      activeRequestIdRef.current = clientRequestId;
      resetGenieActionDedupe();

      store.addMessage({ id: newId(), role: 'user', content: trimmed });
      store.addMessage({ id: newId(), role: 'assistant', content: '', pending: true });
      store.setSending(true);
      store.setToolProgress(null);
      store.setQuickActions([]);

      if (!isApiEnabled) {
        store.updateLastAssistant({
          content: 'API is not configured. Connect to the server to use Genie.',
          pending: false,
        });
        store.setSending(false);
        store.enqueueOffline({ message: trimmed, conversationId: store.conversationId ?? undefined });
        return;
      }

      const resolved = resolveGenieLocation(trimmed, locationCtxRef.current);
      if (resolved.explicitArea) {
        locationCtxRef.current = {
          ...locationCtxRef.current,
          lastExplicitArea: resolved.explicitArea,
        };
      }

      void trackBehavior({
        type: 'search_submitted',
        metadata: {
          source: 'genie',
          hasArea: Boolean(resolved.areaLabel),
        },
        idempotencyKey: `genie-search-${clientRequestId}`,
      });

      try {
        let assistantText = '';
        let cards = store.messages.at(-1)?.cards;
        const isStale = () => activeRequestIdRef.current !== clientRequestId;

        await apiStream<AssistantStreamEvent>(
          '/v1/assistant/chat',
          {
            message: trimmed,
            conversationId: store.conversationId ?? undefined,
            currentScreen: store.currentScreen ?? undefined,
            previousResponseId: store.responseId ?? undefined,
            clientRequestId,
            areaLabel: resolved.areaLabel,
            locationHint: resolved.locationHint,
          },
          event => {
            if (isStale()) return;
            const s = useAssistantStore.getState();
            switch (event.type) {
              case 'token':
                assistantText += event.delta;
                s.updateLastAssistant({ content: assistantText, pending: true });
                break;
              case 'tool_start':
                s.setToolProgress({ toolName: event.toolName, message: event.message });
                break;
              case 'tool_result':
                break;
              case 'result_cards':
                cards = event.cards;
                s.updateLastAssistant({ cards: event.cards, pending: true });
                break;
              case 'navigation':
                executeAssistantNavigation(navigation, event.route, event.params);
                void trackAnalytics(s.conversationId ?? undefined, {
                  type: 'navigation_completed',
                  route: event.route,
                  fromScreen: s.currentScreen ?? undefined,
                });
                void trackBehavior({
                  type: 'genie_action_executed',
                  entityType: 'route',
                  entityId: event.route,
                  metadata: { params: event.params },
                  idempotencyKey: `nav-${clientRequestId}-${event.route}`,
                });
                break;
              case 'action': {
                const outcome = executeGenieAction(navigation, event.action, {
                  onRequestLocation: (purpose, actionId) => {
                    void handleRequestLocation(purpose, actionId);
                  },
                });
                void trackAnalytics(s.conversationId ?? undefined, {
                  type: outcome.ok ? 'action_executed' : 'action_failed',
                  actionType: event.action.type,
                  actionId: event.action.id,
                  ...(outcome.ok ? {} : { code: outcome.reason ?? 'failed' }),
                });
                if (outcome.ok) {
                  void trackBehavior({
                    type: 'genie_action_executed',
                    entityType: event.action.type,
                    entityId: event.action.id,
                    idempotencyKey: `action-${event.action.id}`,
                  });
                }
                break;
              }
              case 'result':
                if (event.outcome === 'no_results' && event.message) {
                  // Prefer streamed assistant text; keep outcome message as fallback hint
                  if (!assistantText.trim()) {
                    s.updateLastAssistant({ content: event.message, pending: true });
                  }
                }
                break;
              case 'quick_actions':
                s.setQuickActions(event.actions);
                break;
              case 'done':
                if (
                  event.clientRequestId &&
                  event.clientRequestId !== clientRequestId
                ) {
                  break;
                }
                s.setConversationId(event.conversationId);
                if (event.responseId) s.setResponseId(event.responseId);
                s.updateLastAssistant({
                  content: event.message || assistantText,
                  cards,
                  pending: false,
                });
                s.setToolProgress(null);
                break;
              case 'error':
                s.updateLastAssistant({ content: event.message, pending: false });
                s.setToolProgress(null);
                void trackAnalytics(s.conversationId ?? undefined, {
                  type: 'stream_failed',
                  code: event.code,
                });
                break;
              default:
                break;
            }
          },
          { signal: abortRef.current.signal },
        );
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (!isAbort && activeRequestIdRef.current === clientRequestId) {
          const message =
            err instanceof ApiError && err.message
              ? err.message
              : 'Something went wrong. Please try again.';
          useAssistantStore.getState().updateLastAssistant({
            content: message,
            pending: false,
          });
          useAssistantStore.getState().enqueueOffline({
            message: trimmed,
            conversationId: useAssistantStore.getState().conversationId ?? undefined,
          });
          void trackAnalytics(useAssistantStore.getState().conversationId ?? undefined, {
            type: 'stream_failed',
            code: err instanceof ApiError ? err.code : 'network_error',
          });
        }
      } finally {
        if (activeRequestIdRef.current === clientRequestId) {
          useAssistantStore.getState().setSending(false);
        }
      }
    },
    [handleRequestLocation, navigation, trackAnalytics, trackBehavior],
  );

  const interrupt = useCallback(() => {
    abortRef.current?.abort();
    activeRequestIdRef.current = null;
    useAssistantStore.getState().setSending(false);
    useAssistantStore.getState().setToolProgress(null);
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    if (!isApiEnabled) return;
    const items = useAssistantStore.getState().drainOfflineQueue();
    for (const item of items) {
      await sendMessage(item.message);
    }
  }, [sendMessage]);

  return { sendMessage, interrupt, flushOfflineQueue };
}

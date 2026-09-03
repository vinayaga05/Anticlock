import { useCallback, useRef } from 'react';
import { apiStream, ApiError } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import type { AssistantStreamEvent } from '@/features/assistant/types';
import { executeAssistantNavigation } from '@/features/assistant/navigation/assistantNavigation';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAssistantChat(navigation: { navigate: (route: string, params?: object) => void }) {
  const abortRef = useRef<AbortController | null>(null);
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

  const sendMessage = useCallback(
    async (text: string) => {
      const store = useAssistantStore.getState();
      if (!store.enabled) return;

      const trimmed = text.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

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

      try {
        let assistantText = '';
        let cards = store.messages.at(-1)?.cards;

        await apiStream<AssistantStreamEvent>(
          '/v1/assistant/chat',
          {
            message: trimmed,
            conversationId: store.conversationId ?? undefined,
            currentScreen: store.currentScreen ?? undefined,
            previousResponseId: store.responseId ?? undefined,
          },
          event => {
            const s = useAssistantStore.getState();
            switch (event.type) {
              case 'token':
                assistantText += event.delta;
                s.updateLastAssistant({ content: assistantText, pending: true });
                break;
              case 'tool_start':
                s.setToolProgress({ toolName: event.toolName, message: event.message });
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
                break;
              case 'quick_actions':
                s.setQuickActions(event.actions);
                break;
              case 'done':
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
                break;
              default:
                break;
            }
          },
          { signal: abortRef.current.signal },
        );
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (!isAbort) {
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
        }
      } finally {
        useAssistantStore.getState().setSending(false);
      }
    },
    [navigation, trackAnalytics],
  );

  const interrupt = useCallback(() => {
    abortRef.current?.abort();
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

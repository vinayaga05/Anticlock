import { useCallback, useEffect, useRef } from 'react';
import { apiStream, apiRequest, ApiError } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { createAnalyticsEventId } from '@/shared/api/reelAnalytics';
import { useAssistantStore } from '../store/assistantStore';
import { locateBusinessViewer } from '@/features/business-profile/businessLocation';
import type { AssistantStreamEvent, AssistantResultCard } from '../types';
import {
  executeAssistantNavigation,
  validAssistantRoute,
  type GenieNavigation,
} from '../navigation/assistantNavigation';
import { rootNavigationRef } from '@/shared/navigation/rootNavigation';
import { interpretSearch, validateSearch } from '../search/interpretSearch';
import {
  searchScreens,
  searchSummary,
  useGenieSearch,
  type SearchContext,
} from '../search/searchState';
import { speakGenieReply, stopGenieSpeech } from '../services/speechOutput';

function logSearchEvent(
  type: string,
  id: string,
  metadata: Record<string, unknown>,
) {
  if (!isApiEnabled) return;
  void apiRequest('/v1/assistant/behavior-events', {
    method: 'POST',
    body: JSON.stringify({
      type,
      metadata,
      idempotencyKey: `genie-${type}-${id}`,
    }),
  }).catch(() => {});
}

function waitForScreen(id: string, signal: AbortSignal) {
  return new Promise<ReturnType<typeof useGenieSearch.getState>['report']>(
    resolve => {
      const finish = (
        result: ReturnType<typeof useGenieSearch.getState>['report'],
      ) => {
        clearTimeout(deadline);
        unsubscribe();
        signal.removeEventListener('abort', cancel);
        resolve(result);
      };
      const cancel = () => finish(null);
      const deadline = setTimeout(cancel, 35_000);
      const unsubscribe = useGenieSearch.subscribe(state => {
        if (
          state.command?.id === id &&
          state.report?.domain === state.command.domain &&
          state.report.status !== 'loading'
        ) {
          finish(state.report);
        }
      });
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    },
  );
}

export function useAssistantChat(navigation: GenieNavigation) {
  const abortRef = useRef<AbortController | null>(null);
  const pending = useRef<{ assistantId: string; searchId?: string } | null>(
    null,
  );
  const clarification = useRef<{
    type: 'area' | 'budget' | 'category';
    context?: SearchContext;
  } | null>(null);
  const previous = useRef<SearchContext | null>(null);
  const lastOpened = useRef<string | null>(null);
  const retry = useRef<string | null>(null);

  const interrupt = useCallback(() => {
    abortRef.current?.abort();
    stopGenieSpeech();
    const turn = pending.current;
    if (turn?.searchId) useGenieSearch.getState().cancel(turn.searchId);
    if (turn)
      useAssistantStore.getState().updateMessage(turn.assistantId, {
        content: 'Stopped.',
        pending: false,
      });
    pending.current = null;
    const store = useAssistantStore.getState();
    store.setSending(false);
    store.setToolProgress(null);
  }, []);
  useEffect(() => interrupt, [interrupt]);

  const sendMessage = useCallback(
    async (input: string) => {
      const store = useAssistantStore.getState();
      if (!store.enabled || !input.trim()) return;
      const text =
        /^retry$/i.test(input.trim()) && retry.current
          ? retry.current
          : input.trim();
      retry.current = text;
      interrupt();
      const clientRequestId = createAnalyticsEventId();
      const assistantId = `${clientRequestId}:reply`;
      const controller = new AbortController();
      abortRef.current = controller;
      pending.current = { assistantId };
      const { signal } = controller;
      store.addMessage({ id: clientRequestId, role: 'user', content: text });
      store.addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        pending: true,
      });
      store.setSending(true);
      store.setQuickActions([]);
      const voice = store.voiceMode || store.voiceOutput;
      const reply = (content: string, cards?: AssistantResultCard[]) => {
        if (signal.aborted) return;
        const current = useAssistantStore.getState();
        current.updateMessage(assistantId, { content, pending: false, cards });
        current.setToolProgress(null);
        if (voice) void speakGenieReply(content);
      };
      const report = useGenieSearch.getState().report;
      const context =
        clarification.current?.context ??
        report ??
        useGenieSearch.getState().requestedContext;

      const applySearch = async (
        next: SearchContext,
        needsLocation = false,
      ) => {
        const id = `${clientRequestId}:search`;
        const state = useGenieSearch.getState();
        if (needsLocation) {
          try {
            const point = await locateBusinessViewer(
              'Location for Genie',
              'Use your location to find nearby services.',
            );
            if (signal.aborted) return;
            state.setPosition(point);
          } catch {
            if (signal.aborted) return;
            clarification.current = { type: 'area', context: next };
            reply(
              'I couldn’t use your location. Which area, city, or PIN should I search?',
            );
            return;
          }
        }
        if (signal.aborted || !pending.current) return;
        clarification.current = null;
        previous.current = context
          ? { domain: context.domain, filters: context.filters }
          : null;
        lastOpened.current = null;
        pending.current.searchId = id;
        const confirmed = waitForScreen(id, signal);
        logSearchEvent('search_submitted', clientRequestId, {
          domain: next.domain,
          hasArea: Boolean(next.filters.areaLabel),
        });

        state.request({ ...next, id });
        const currentRoute = rootNavigationRef.isReady()
          ? rootNavigationRef.getCurrentRoute()
          : undefined;
        const currentParams = currentRoute?.params as
          | { categoryId?: string }
          | undefined;
        const sameScreen =
          currentRoute?.name === searchScreens[next.domain] &&
          (next.domain !== 'services' ||
            currentParams?.categoryId === next.filters.categoryId);
        if (!sameScreen) {
          if (next.domain === 'services')
            navigation.navigate('ServiceCategory', {
              categoryId: next.filters.categoryId,
              treeId: next.filters.treeId,
            });
          else
            executeAssistantNavigation(navigation, 'Main', {
              screen: searchScreens[next.domain],
              ...(next.domain === 'knock' ? { initialTab: 'bookings' } : {}),
            });
        }
        useAssistantStore.getState().setToolProgress({
          toolName: 'search',
          message: 'Checking the results on screen…',
        });
        const result = await confirmed;
        if (signal.aborted) return;
        state.cancel(id);
        if (!result) {
          store.setQuickActions(['Retry']);
          reply(
            'The results screen hasn’t finished loading. Try again in a moment.',
          );
          return;
        }
        if (result.status === 'error') store.setQuickActions(['Retry']);
        else if (
          result.status === 'ready' &&
          !result.rows.length &&
          next.domain === 'services' &&
          (result.filters.areaLabel || result.filters.nearby)
        )
          store.setQuickActions(['Search nearby areas', 'Undo']);
        else if (previous.current) store.setQuickActions(['Undo']);
        reply(searchSummary(result));
        if (result.status === 'ready')
          logSearchEvent('genie_action_executed', id, { domain: next.domain });

        if (result.status === 'ready' && result.rows.length)
          store.closeAssistant();
      };

      try {
        if (
          /^undo(?: last (?:filter|change))?$/i.test(text) &&
          previous.current
        ) {
          await applySearch(previous.current);
          return;
        }
        if (
          /^what (?:does verified mean|is a verified provider)[.?!]*$/i.test(
            text,
          )
        ) {
          reply(
            'A verified provider has an approved business profile in Knock. Check their reviews, prices, and available times on the profile.',
          );
          return;
        }
        const interpreted = interpretSearch(
          text,
          context,
          clarification.current?.type,
        );
        if (interpreted.type === 'question') {
          if (interpreted.waiting)
            clarification.current = {
              type: interpreted.waiting,
              context: interpreted.context,
            };
          reply(interpreted.text);
          return;
        }
        if (interpreted.type === 'open' || interpreted.type === 'explain') {
          const index = interpreted.index;
          const row =
            index === -2
              ? report?.rows.find(row => row.id === lastOpened.current)
              : report?.rows.at(index);
          if (!row || report?.status !== 'ready') {
            reply(
              index === -2
                ? 'Which result do you mean? Try “Why did you show the second one?”'
                : 'I don’t see that result in the current list.',
            );
            return;
          }
          if (interpreted.type === 'explain') {
            reply(
              row.detail
                ? `${row.name} matched the filters on screen. The listing shows ${row.detail}.`
                : `${row.name} is in the current results. I don’t have more details about the match.`,
            );
          } else if (row.open) {
            lastOpened.current = row.id;
            row.open();
            reply(`Opening ${row.name}.`);
            store.closeAssistant();
          } else reply('This result doesn’t have a detail page here.');
          return;
        }
        if (interpreted.type === 'search') {
          await applySearch(interpreted.context, interpreted.needsLocation);
          return;
        }
        if (!isApiEnabled) {
          reply('Connect to the server to use Genie.');
          return;
        }
        let answer = '';
        let cards: AssistantResultCard[] | undefined;
        let action:
          | Extract<AssistantStreamEvent, { type: 'action' }>['action']
          | undefined;
        let legacy:
          | Extract<AssistantStreamEvent, { type: 'navigation' }>
          | undefined;
        let done = false;
        let failure: string | undefined;
        await apiStream<AssistantStreamEvent>(
          '/v1/assistant/chat',
          {
            message: text,
            conversationId: store.conversationId ?? undefined,
            currentScreen: store.currentScreen ?? undefined,
            previousResponseId: store.responseId ?? undefined,
            clientRequestId,
            areaLabel: context?.filters.areaLabel,
          },
          event => {
            if (signal.aborted) return;
            const live = useAssistantStore.getState();
            switch (event.type) {
              case 'token':
                answer += event.delta;
                break;
              case 'result_cards':
                cards = event.cards;
                break;
              case 'tool_start':
                live.setToolProgress({
                  toolName: event.toolName,
                  message: event.message,
                });
                break;
              case 'navigation':
                legacy = event;
                break;
              case 'action':
                action = event.action;
                break;
              case 'quick_actions':
                live.setQuickActions(event.actions);
                break;
              case 'error':
                failure = event.message;
                break;
              case 'done':
                if (
                  event.clientRequestId &&
                  event.clientRequestId !== clientRequestId
                )
                  break;
                live.setConversationId(event.conversationId);
                if (event.responseId) live.setResponseId(event.responseId);
                answer = event.message || answer;
                done = true;
                break;
            }
          },
          { signal },
        );
        if (signal.aborted) return;
        if (failure) {
          reply(failure);
          store.setQuickActions(['Retry']);
          return;
        }
        if (!done) {
          reply('The connection ended before Genie could finish. Try again.');
          store.setQuickActions(['Retry']);
          return;
        }
        if (action?.type === 'open_search_results') {
          const validated = validateSearch(action.domain, action.filters ?? {});
          if (validated) await applySearch(validated);
          else reply('The results screen doesn’t support those filters.');
          return;
        }
        if (action?.type === 'request_location') {
          if (context) clarification.current = { type: 'area', context };
          reply('Which area, city, or PIN should I search?');
          return;
        }
        if (action?.type === 'confirm_mutation') {
          reply('That change needs to be confirmed on its own screen.');
          return;
        }
        if (action && action.version !== 1) {
          reply('That action isn’t supported by this version of the app.');
          return;
        }
        const target = action?.type === 'navigate' ? action.target : legacy;
        if (target) {
          const params = target.params ?? {};
          if (!validAssistantRoute(target.route, params)) {
            reply(
              'That destination isn’t available in this version of the app.',
            );
            return;
          }
          if (target.route === 'ServiceCategory') {
            const search = validateSearch('services', params);
            if (search) {
              await applySearch(search);
              return;
            }
          }
          if (target.route === 'Main' && !params.reelId) {
            const domain = (
              Object.keys(searchScreens) as Array<keyof typeof searchScreens>
            ).find(domain => searchScreens[domain] === params.screen);
            const filters = Object.fromEntries(
              Object.entries(params).filter(
                ([key]) => key !== 'screen' && key !== 'initialTab',
              ),
            );
            const search = domain && validateSearch(domain, filters);
            if (
              search &&
              (!params.initialTab || params.initialTab === 'bookings')
            ) {
              await applySearch(search);
              return;
            }
          }
          executeAssistantNavigation(navigation, target.route, params);
          store.closeAssistant();
        }
        reply(answer || 'What would you like to find?', cards);
      } catch (err) {
        if (signal.aborted) return;
        store.setQuickActions(['Retry']);
        reply(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      } finally {
        if (!signal.aborted) {
          pending.current = null;
          store.setSending(false);
          store.setToolProgress(null);
        }
      }
    },
    [interrupt, navigation],
  );
  return { sendMessage, interrupt };
}

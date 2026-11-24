import { useLayoutEffect, useRef, useReducer } from 'react';
import { useAssistantStore } from '../store/assistantStore';
import {
  searchScreens,
  useGenieSearch,
  type SearchFilters,
  type SearchReport,
} from './searchState';

/** The screen owns its controls and response. Publish only after applying the command. */
export function useGenieScreen(
  report: SearchReport,
  apply?: (filters: SearchFilters) => void,
  enabled = true,
  routeKey?: string,
) {
  const screen = useAssistantStore(s => s.currentScreen);
  const command = useGenieSearch(s => s.command);
  const currentKey = useAssistantStore(s => s.currentRouteKey);
  const active =
    enabled &&
    screen === searchScreens[report.domain] &&
    (!routeKey || routeKey === currentKey);
  const [, applied] = useReducer((value: number) => value + 1, 0);

  const appliedId = useRef<string | null>(null);
  const published = useRef<string | null>(null);
  const target =
    command?.domain === report.domain &&
    (report.domain !== 'services' ||
      command.filters.categoryId === report.filters.categoryId)
      ? command
      : null;
  // Getter functions on rows capture the latest version of the screen's own handlers.
  const latest = useRef(report);
  latest.current = report;
  useLayoutEffect(() => {
    if (!active) {
      published.current = null;
      return;
    }
    if (command && !target) return;
    if (target && target.id !== appliedId.current && apply) {
      appliedId.current = target.id;
      published.current = null;
      apply(target.filters);
      applied();

      // The following layout pass contains the new filter and query state.
      return;
    }
    const state = useGenieSearch.getState();
    if (
      target &&
      !Object.entries(target.filters).every(
        ([key, value]) => report.filters[key as keyof SearchFilters] === value,
      )
    )
      return;
    const revision = `${target?.id ?? ''}:${JSON.stringify(report)}`;
    if (published.current === revision && state.report) return;
    published.current = revision;
    state.publish({
      ...latest.current,
      rows: latest.current.rows.map(row =>
        !row.open
          ? row
          : {
              ...row,
              open: () =>
                latest.current.rows.find(next => next.id === row.id)?.open?.(),
            },
      ),
    });
  });
}

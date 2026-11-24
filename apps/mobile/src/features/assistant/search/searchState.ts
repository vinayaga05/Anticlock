import { create } from 'zustand';
import type { GenieActionDomain } from '@anticlock/contracts';

export type SearchFilters = {
  categoryId?: string;
  treeId?: string;
  q?: string;
  areaLabel?: string;
  nearby?: boolean;
  sort?: 'closest' | 'rating' | 'price' | 'highPrice' | 'recent';
  maxPrice?: number;
  minRating?: number;
  verified?: boolean;
  availability?: 'open_now' | 'today';
  sport?: string;
  joining?: boolean;
  teams?: boolean;
  following?: boolean;
  upcoming?: boolean;
};

export type SearchContext = {
  domain: GenieActionDomain;
  filters: SearchFilters;
};
export type SearchAction = SearchContext & { id: string };
export type SearchRow = {
  id: string;
  name: string;
  detail?: string;
  open?: () => void;
};
export type SearchReport = SearchContext & {
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  rows: SearchRow[];
  partial?: boolean;
  message?: string;
};

export const searchScreens: Record<GenieActionDomain, string> = {
  services: 'ServiceCategory',
  needs: 'Needs',
  clips: 'PlayFeed',
  shop: 'Shop',
  flash: 'Flash',
  community: 'Community',
  knock: 'Knock',
};

export const useGenieSearch = create<{
  position?: { latitude: number; longitude: number };
  setPosition: (position: { latitude: number; longitude: number }) => void;
  command: SearchAction | null;
  report: SearchReport | null;
  requestedContext: SearchContext | null;
  request: (command: SearchAction) => void;
  publish: (report: SearchReport) => void;
  cancel: (id?: string) => void;
  reset: () => void;
}>(set => ({
  position: undefined,
  setPosition: position => set({ position }),
  command: null,
  report: null,
  requestedContext: null,
  request: command => set({ command, report: null, requestedContext: command }),
  publish: report => set({ report }),
  cancel: id =>
    set(s => (!id || s.command?.id === id ? { command: null } : {})),
  reset: () =>
    set({
      position: undefined,
      command: null,
      report: null,
      requestedContext: null,
    }),
}));

export function searchSummary(report: SearchReport): string {
  if (report.message) return report.message;
  if (report.status === 'error')
    return 'I couldn’t load these results. Try again in a moment.';
  if (report.status === 'unavailable')
    return 'That filter isn’t available on this screen.';
  const labels = [
    report.filters.areaLabel,
    report.filters.nearby ? 'nearby' : undefined,
    report.filters.availability === 'today'
      ? 'available today'
      : report.filters.availability
      ? 'open now'
      : undefined,
    report.filters.minRating ? `rated ${report.filters.minRating}+` : undefined,
    report.filters.verified ? 'verified' : undefined,
    report.filters.maxPrice != null
      ? `priced up to ₹${report.filters.maxPrice}`
      : undefined,
    report.filters.following ? 'from people you follow' : undefined,
    report.filters.upcoming ? 'upcoming' : undefined,
    report.filters.sport,
  ]
    .filter(Boolean)
    .join(', ');
  const context = labels ? ` (${labels})` : '';
  if (!report.rows.length)
    return report.partial
      ? `No matches in the results loaded so far${context}.`
      : `No matches${context}.`;
  const n = report.rows.length;
  const sort = report.filters.sort;
  const order =
    sort === 'closest'
      ? ' Closest first.'
      : sort === 'rating'
      ? ' Highest rated first.'
      : sort === 'price'
      ? ' Lowest price first.'
      : sort === 'highPrice'
      ? ' Highest price first.'
      : sort === 'recent'
      ? ' Most recent first.'
      : '';
  return `${report.partial ? 'The screen shows' : 'I found'} ${n} ${
    n === 1 ? 'match' : 'matches'
  }${context}.${order}`;
}

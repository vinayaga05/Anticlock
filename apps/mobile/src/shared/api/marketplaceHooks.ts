import { useQuery } from '@tanstack/react-query';
import type { MarketplaceProviderCard } from '@/features/provider-onboarding/types';
import type {
  MarketplaceProvider,
  ServiceActionType,
} from '@/shared/data/services/serviceTypes';
import {
  getProvider,
  getProvidersForCategory,
  searchCatalog,
} from '@/shared/data/services/catalog';
import { apiRequest } from './client';
import { isApiEnabled } from './config';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approved businesses from the API have UUID ids; demo fixtures do not. */
export function isMarketplaceProviderId(id: string | undefined): id is string {
  return Boolean(id && UUID_RE.test(id));
}

const MODE_LABELS: Record<string, string> = {
  center: 'At centre',
  home: 'Home visit',
  online: 'Online',
};

const ACTION_TYPES = new Set<ServiceActionType>([
  'appointment',
  'class_booking',
  'membership',
  'event_booking',
  'home_service',
  'course_enrollment',
  'product_purchase',
  'property_enquiry',
  'transport_booking',
  'service_request',
]);

/** Maps an API marketplace card onto the app's existing provider shape. */
export function mapMarketplaceCard(
  card: MarketplaceProviderCard,
): MarketplaceProvider {
  const primary = card.categories[0];
  const actionType =
    primary?.actionType &&
    ACTION_TYPES.has(primary.actionType as ServiceActionType)
      ? (primary.actionType as ServiceActionType)
      : 'appointment';
  const categoryNames = card.categories.map(c => c.name).filter(Boolean);
  return {
    id: card.id,
    name: card.name,
    type:
      primary?.name ??
      (card.providerKind === 'business' ? 'Business' : 'Professional'),
    categoryIds: card.categoryIds,
    actionType,
    imageUrl: card.avatarUrl ?? card.coverUrl ?? '',
    rating: 0,
    reviewCount: 0,
    location: { city: card.city ?? '', area: card.area ?? '' },
    priceFrom: card.priceFrom ?? undefined,
    verified: card.verified,
    subtitle: [categoryNames.slice(0, 2).join(', '), card.city]
      .filter(Boolean)
      .join(' · '),
    tags: card.modes.map(m => MODE_LABELS[m] ?? m),
    about: card.description ?? undefined,
    modes: card.modes,
  };
}

export type MarketplaceProviderFilters = {
  q?: string;
  categoryId?: string;
  treeId?: string;
  city?: string;
  limit?: number;
};

function fixtureProviders(
  filters: MarketplaceProviderFilters,
): MarketplaceProvider[] {
  if (filters.categoryId) {
    const list = getProvidersForCategory(filters.categoryId);
    const q = filters.q?.trim().toLowerCase();
    return q
      ? list.filter(p =>
          `${p.name} ${p.type} ${p.subtitle ?? ''}`.toLowerCase().includes(q),
        )
      : list;
  }
  return searchCatalog(filters.q ?? '').providers;
}

/**
 * Marketplace providers: approved, active businesses from the API. Demo
 * fixtures are used only when the app runs without an API.
 */
export function useMarketplaceProvidersQuery(
  filters: MarketplaceProviderFilters,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [
      'marketplace',
      'providers',
      filters,
      isApiEnabled ? 'api' : 'local',
    ],
    enabled: options.enabled ?? true,
    staleTime: 30_000,
    queryFn: async (): Promise<MarketplaceProvider[]> => {
      if (!isApiEnabled) return fixtureProviders(filters);
      const qs = new URLSearchParams();
      if (filters.q?.trim()) qs.set('q', filters.q.trim());
      if (filters.categoryId) qs.set('categoryId', filters.categoryId);
      if (filters.treeId) qs.set('treeId', filters.treeId);
      if (filters.city) qs.set('city', filters.city);
      qs.set('limit', String(filters.limit ?? 30));
      const res = await apiRequest<{ data: MarketplaceProviderCard[] }>(
        `/v1/marketplace/providers?${qs.toString()}`,
      );
      return res.data.map(mapMarketplaceCard);
    },
  });
}

export function useMarketplaceProviderQuery(providerId: string | undefined) {
  return useQuery({
    queryKey: [
      'marketplace',
      'provider',
      providerId,
      isApiEnabled ? 'api' : 'local',
    ],
    enabled: Boolean(providerId),
    queryFn: async (): Promise<MarketplaceProvider | null> => {
      if (!providerId) return null;
      // Demo ids (e.g. from fixture-only screens) never exist in the API.
      if (!isApiEnabled || !isMarketplaceProviderId(providerId)) {
        return getProvider(providerId) ?? null;
      }
      const res = await apiRequest<{ provider: MarketplaceProviderCard }>(
        `/v1/marketplace/providers/${providerId}`,
      );
      return mapMarketplaceCard(res.provider);
    },
  });
}

/** True when provider lists should come from the API instead of fixtures. */
export const marketplaceUsesApi = isApiEnabled;

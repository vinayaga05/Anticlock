import { useQuery } from '@tanstack/react-query';
import type { BusinessAvailability } from '@anticlock/contracts';
import type { MarketplaceProvider } from '@/shared/data/services/serviceTypes';
import { apiRequest, ApiError } from '@/shared/api/client';
import type { SearchFilters } from './searchState';

type Point = { latitude: number; longitude: number };
export function distanceKm(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const d =
    Math.sin(((a.latitude - b.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((a.longitude - b.longitude) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, d)));
}

export function marketplaceOpenNow(provider: MarketplaceProvider, now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)?.value;
  const time = `${part('hour')}:${part('minute')}`;
  return Boolean(
    !provider.temporarilyUnavailable &&
      provider.openingTime &&
      provider.closingTime &&
      provider.workingDays?.some(
        d => d.slice(0, 3).toLowerCase() === part('weekday')?.toLowerCase(),
      ) &&
      provider.openingTime.slice(0, 5) <= time &&
      time < provider.closingTime.slice(0, 5),
  );
}

export function filterProviderResults(
  providers: MarketplaceProvider[],
  filters: SearchFilters,
  position?: Point,
  now = new Date(),
) {
  const area = filters.areaLabel?.trim().toLowerCase();
  const rows = providers.flatMap(provider => {
    const {
      latitude,
      longitude,
      city,
      area: locality,
      pincode,
    } = provider.location;
    if (
      area &&
      !area
        .split(',')
        .every(term =>
          [city, locality, pincode]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term.trim()),
        )
    )
      return [];
    const distance =
      position && latitude != null && longitude != null
        ? distanceKm(position, { latitude, longitude })
        : undefined;
    if (filters.nearby && (distance == null || distance > 25)) return [];
    if (
      filters.maxPrice != null &&
      (provider.priceFrom == null || provider.priceFrom > filters.maxPrice)
    )
      return [];
    if (
      filters.minRating != null &&
      (!provider.reviewCount || provider.rating < filters.minRating)
    )
      return [];
    if (filters.verified && !provider.verified) return [];
    if (
      filters.availability === 'open_now' &&
      !marketplaceOpenNow(provider, now)
    )
      return [];
    return [
      { ...provider, location: { ...provider.location, distanceKm: distance } },
    ];
  });
  if (filters.sort === 'price')
    rows.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
  if (filters.sort === 'rating')
    rows.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  if (filters.sort === 'closest')
    rows.sort(
      (a, b) =>
        (a.location.distanceKm ?? Infinity) -
        (b.location.distanceKm ?? Infinity),
    );
  return rows;
}

export function useProvidersAvailableToday(
  providers: MarketplaceProvider[],
  categoryId: string,
  enabled: boolean,
) {
  const date = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const candidates = providers.flatMap(provider => {
    const categories = provider.categoryIds.filter(
      id => id === categoryId || id.startsWith(`${categoryId}.`),
    );
    return categories.length && provider.modes?.length
      ? [{ id: provider.id, categories, modes: provider.modes }]
      : [];
  });
  return useQuery({
    queryKey: ['marketplace', 'available-today', date, candidates],
    enabled: enabled && candidates.length > 0,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const available = new Set<string>();
      let next = 0;
      const controller = new AbortController();
      const abort = () => controller.abort();
      const timer = setTimeout(abort, 18_000);
      signal.addEventListener('abort', abort, { once: true });
      try {
        if (signal.aborted) abort();
        await Promise.all(
          Array.from({ length: Math.min(5, candidates.length) }, async () => {
            while (next < candidates.length && !controller.signal.aborted) {
              const item = candidates[next++];
              for (const categoryId of item.categories) {
                for (const serviceMode of item.modes) {
                  const q = new URLSearchParams({
                    date,
                    categoryId,
                    serviceMode,
                  });
                  try {
                    const response = await apiRequest<{
                      availability: BusinessAvailability;
                    }>(`/v1/business-profiles/${item.id}/availability?${q}`, {
                      signal: controller.signal,
                    });
                    if (
                      response.availability.slots.some(slot => slot.available)
                    ) {
                      available.add(item.id);
                      break;
                    }
                  } catch (err) {
                    if (!(err instanceof ApiError) || err.status !== 404)
                      throw err;
                  }
                }
                if (available.has(item.id)) break;
              }
            }
          }),
        );
        if (controller.signal.aborted)
          throw new Error('Availability did not load');
        return [...available];
      } finally {
        abort();
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    },
  });
}

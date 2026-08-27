import { marketplaceEvents, marketplaceProducts } from '@/shared/data/services';
import type {
  ExploreEventItem,
  ExploreItem,
  ExploreProductItem,
  ExploreReviewStatus,
  ExploreVisibility,
} from './types';

const publicMeta = (by: string, at: string): ExploreSubmissionMetaLike => ({
  reviewStatus: 'approved',
  visibility: 'public',
  submittedBy: by,
  submittedAt: at,
});

type ExploreSubmissionMetaLike = ExploreEventItem['meta'];

function mapEvent(
  e: (typeof marketplaceEvents)[0],
  overrides?: Partial<ExploreEventItem>,
): ExploreEventItem {
  return {
    kind: 'event',
    id: e.id,
    title: e.title,
    imageUrl: e.imageUrl,
    organizer: e.organizer,
    dateLabel: e.dateLabel,
    location: e.destination,
    price: e.price,
    spotsLeft: e.slotsLeft,
    category: e.categoryId,
    meta: publicMeta(e.organizer, '2026-03-01'),
    ...overrides,
  };
}

function mapProduct(
  p: (typeof marketplaceProducts)[0],
  overrides?: Partial<ExploreProductItem>,
): ExploreProductItem {
  return {
    kind: 'product',
    id: p.id,
    title: p.name,
    imageUrl: p.imageUrl,
    seller: p.seller,
    price: p.price,
    rating: p.rating,
    reviewCount: Math.round(p.rating * 40),
    category: p.categoryId,
    meta: publicMeta(p.seller, '2026-03-01'),
    ...overrides,
  };
}

export const featuredEvents: ExploreEventItem[] = marketplaceEvents
  .slice(0, 3)
  .map(e => mapEvent(e));

export const trendingProducts: ExploreProductItem[] = marketplaceProducts
  .filter(p => !p.isProperty)
  .slice(0, 4)
  .map(p => mapProduct(p));

export const nearYouItems: ExploreItem[] = [
  mapProduct(marketplaceProducts[0]),
  mapEvent(marketplaceEvents[2], { distanceKm: 2.5, timeLabel: '6:00 AM' }),
  mapProduct(marketplaceProducts[1]),
  mapEvent(marketplaceEvents[4], { distanceKm: 4.1 }),
];

export const upcomingEvents: ExploreEventItem[] = marketplaceEvents.map(e => mapEvent(e));

export const fromPeopleYouFollow: ExploreItem[] = [
  {
    kind: 'event',
    id: 'sub-evt-yoga',
    title: 'Yoga Workshop',
    imageUrl:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&h=600&q=80',
    organizer: 'Priya',
    dateLabel: 'Sep 6',
    timeLabel: '7:00 AM',
    location: 'T. Nagar, Chennai',
    distanceKm: 3.2,
    price: 499,
    spotsLeft: 12,
    meta: {
      reviewStatus: 'pending_review',
      visibility: 'followers_only',
      submittedBy: 'Priya',
      submittedAt: '2026-08-26',
    },
  },
  {
    kind: 'product',
    id: 'sub-prod-band',
    title: 'Resistance Band Set',
    imageUrl:
      'https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=800&h=600&q=80',
    seller: 'Ravi',
    price: 899,
    rating: 4.7,
    reviewCount: 128,
    meta: {
      reviewStatus: 'pending_review',
      visibility: 'followers_only',
      submittedBy: 'Ravi',
      submittedAt: '2026-08-25',
    },
  },
  {
    kind: 'event',
    id: 'sub-evt-cycle',
    title: 'Weekend Cycling Meetup',
    imageUrl:
      'https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=800&h=600&q=80',
    organizer: 'Priya',
    dateLabel: 'Aug 30',
    timeLabel: '6:00 AM',
    location: 'Chennai',
    distanceKm: 2.5,
    price: 499,
    spotsLeft: 18,
    meta: {
      reviewStatus: 'needs_changes',
      visibility: 'followers_only',
      submittedBy: 'Priya',
      submittedAt: '2026-08-24',
      reviewNote: 'Please add venue details and a clearer cover image.',
    },
  },
];

export const myExploreSubmissions: ExploreItem[] = [
  ...fromPeopleYouFollow.filter(i => i.meta.submittedBy === 'Priya'),
  {
    kind: 'product',
    id: 'sub-prod-mine',
    title: 'Foam Roller Pro',
    imageUrl:
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&h=600&q=80',
    seller: 'You',
    price: 1299,
    rating: 0,
    reviewCount: 0,
    meta: {
      reviewStatus: 'approved',
      visibility: 'public',
      submittedBy: 'You',
      submittedAt: '2026-08-20',
    },
  },
];

export const exploreModerationQueue: ExploreItem[] = fromPeopleYouFollow.filter(
  i =>
    i.meta.reviewStatus === 'pending_review' ||
    i.meta.reviewStatus === 'needs_changes',
);

export function filterExploreItems(
  items: ExploreItem[],
  filter: 'all' | 'events' | 'products',
): ExploreItem[] {
  if (filter === 'events') return items.filter(i => i.kind === 'event');
  if (filter === 'products') return items.filter(i => i.kind === 'product');
  return items;
}

export function searchExploreItems(query: string): ExploreItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool: ExploreItem[] = [
    ...featuredEvents,
    ...trendingProducts,
    ...nearYouItems,
    ...upcomingEvents,
    ...fromPeopleYouFollow,
    ...myExploreSubmissions,
  ];
  const seen = new Set<string>();
  return pool.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    const hay = `${item.title} ${
      item.kind === 'event' ? item.organizer : item.seller
    }`.toLowerCase();
    return hay.includes(q);
  });
}

export function getExploreItem(id: string): ExploreItem | undefined {
  return [
    ...featuredEvents,
    ...trendingProducts,
    ...nearYouItems,
    ...upcomingEvents,
    ...fromPeopleYouFollow,
    ...myExploreSubmissions,
  ].find(i => i.id === id);
}

export type ExploreQuickFilter = {
  id: string;
  label: string;
  appliesTo: 'all' | 'events' | 'products';
};

export const exploreQuickFilters: ExploreQuickFilter[] = [
  { id: 'today', label: 'Today', appliesTo: 'events' },
  { id: 'weekend', label: 'This Weekend', appliesTo: 'events' },
  { id: 'nearby', label: 'Nearby', appliesTo: 'all' },
  { id: 'free', label: 'Free', appliesTo: 'events' },
  { id: 'under500', label: 'Under ₹500', appliesTo: 'products' },
  { id: 'top_rated', label: 'Top Rated', appliesTo: 'products' },
  { id: 'newest', label: 'Newest', appliesTo: 'products' },
];

export function applyQuickFilter(
  items: ExploreItem[],
  quickId: string | null,
): ExploreItem[] {
  if (!quickId) return items;
  switch (quickId) {
    case 'free':
      return items.filter(i => i.kind === 'event' && i.price === 0);
    case 'under500':
      return items.filter(i => i.kind === 'product' && i.price < 500);
    case 'top_rated':
      return items.filter(i => i.kind === 'product' && i.rating >= 4.5);
    case 'nearby':
      return items.filter(
        i =>
          (i.kind === 'event' &&
            typeof i.distanceKm === 'number' &&
            i.distanceKm <= 5) ||
          (i.kind === 'product' && nearYouItems.some(n => n.id === i.id)),
      );
    case 'today':
    case 'weekend':
      return items.filter(i => i.kind === 'event');
    case 'newest':
      return [...items].reverse();
    default:
      return items;
  }
}

export function buildPendingMeta(
  by: string,
  status: ExploreReviewStatus = 'pending_review',
  visibility: ExploreVisibility = 'followers_only',
): ExploreEventItem['meta'] {
  return {
    reviewStatus: status,
    visibility,
    submittedBy: by,
    submittedAt: new Date().toISOString().slice(0, 10),
  };
}

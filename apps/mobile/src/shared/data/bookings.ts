import { ServiceMode, FitnessClass } from '@/shared/types';
import {
  buildStartsAt,
  formatBookingRange,
  formatBookingWhen,
  getTimelineSectionLabel,
  isPastBooking,
  isThisMonth,
  isThisWeek,
  isToday,
  minutesUntil,
} from '@/shared/utils/bookingDates';

export type BookingFilter = 'all' | 'on_site' | 'online' | 'classes';

export type BookingAction =
  | 'view_details'
  | 'join_now'
  | 'reschedule'
  | 'cancel'
  | 'book_again'
  | 'directions'
  | 'track'
  | 'contact'
  | 'prepare'
  | 'rate';

export type BookingStatus =
  | 'confirmed'
  | 'upcoming'
  | 'online_live'
  | 'provider_assigned'
  | 'on_the_way'
  | 'completed'
  | 'cancelled'
  | 'pending'
  | 'rejected'
  | 'reschedule_requested'
  | 'no_show';

export type BookingCategory =
  | 'appointment'
  | 'class'
  | 'home_service'
  | 'lab'
  | 'event'
  | 'hospital'
  | 'other';

export type BookingVisual = 'avatar' | 'logo' | 'thumbnail' | 'icon';

export type ConsolidatedBooking = {
  id: string;
  providerName: string;
  serviceTitle: string;
  startsAt: string;
  endsAt?: string;
  locationLabel?: string;
  mode?: ServiceMode;
  isOnline: boolean;
  isClass: boolean;
  category: BookingCategory;
  status: BookingStatus;
  statusLabel: string;
  bookingType?: string;
  viewerRole?: 'customer' | 'provider';
  customerName?: string;
  customerId?: string;
  providerId?: string;
  paymentStatus?: string;
  visual: BookingVisual;
  providerRole?: string;
  durationMinutes?: number;
  etaMinutes?: number;
  amount?: number;
  imageUrl?: string;
  iconName?: string;
  entityId?: string;
  testId?: string;
  /** False for discovery-only rows (not shown on Bookings timeline). */
  isReserved?: boolean;
};

export type BookingAdvancedFilters = {
  status?: 'upcoming' | 'completed' | 'cancelled' | null;
  types: BookingCategory[];
  date?: 'today' | 'this_week' | 'this_month' | null;
};

export type ResolvedBookingActions = {
  primary?: BookingAction;
  secondary?: BookingAction;
};

export type TimelineSection = {
  label: 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'LATER';
  items: ConsolidatedBooking[];
};

export function isBookedItem(booking: ConsolidatedBooking): boolean {
  return booking.isReserved !== false;
}

export function getBookedItems(items: ConsolidatedBooking[]): ConsolidatedBooking[] {
  return items.filter(isBookedItem);
}

export function getUpcomingBookings(
  items: ConsolidatedBooking[],
  now = new Date(),
): ConsolidatedBooking[] {
  return getBookedItems(items).filter(
    b =>
      !isPastBooking(b.startsAt, now) &&
      !['completed', 'cancelled', 'rejected'].includes(b.status),
  );
}

export function getPastBookings(
  items: ConsolidatedBooking[],
  now = new Date(),
): ConsolidatedBooking[] {
  return getBookedItems(items).filter(
    b =>
      isPastBooking(b.startsAt, now) ||
      ['completed', 'cancelled', 'rejected'].includes(b.status),
  );
}

export function getNextUpBooking(
  items: ConsolidatedBooking[],
  now = new Date(),
): ConsolidatedBooking | undefined {
  const upcoming = getUpcomingBookings(items, now)
    .filter(b => b.status !== 'pending')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return upcoming[0];
}

export function groupBookingsByTimeline(
  items: ConsolidatedBooking[],
  now = new Date(),
  excludeId?: string,
): { nextUp?: ConsolidatedBooking; sections: TimelineSection[] } {
  const nextUp = getNextUpBooking(items, now);
  const upcoming = getUpcomingBookings(items, now).filter(
    b => b.id !== nextUp?.id && b.id !== excludeId,
  );

  const buckets: Record<TimelineSection['label'], ConsolidatedBooking[]> = {
    TODAY: [],
    TOMORROW: [],
    THIS_WEEK: [],
    LATER: [],
  };

  for (const item of upcoming) {
    if (item.id === excludeId) continue;
    const label = getTimelineSectionLabel(item.startsAt, now);
    buckets[label].push(item);
  }

  for (const key of Object.keys(buckets) as TimelineSection['label'][]) {
    buckets[key].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  const sections = (['TODAY', 'TOMORROW', 'THIS_WEEK', 'LATER'] as const)
    .map(label => ({ label, items: buckets[label] }))
    .filter(section => section.items.length > 0);

  return { nextUp: nextUp?.id !== excludeId ? nextUp : undefined, sections };
}

export function resolveBookingActions(
  booking: ConsolidatedBooking,
  now = new Date(),
): ResolvedBookingActions {
  const mins = minutesUntil(booking.startsAt, now);

  if (booking.viewerRole === 'provider') {
    return { primary: 'view_details' };
  }

  if (booking.status === 'completed') {
    return { primary: 'book_again', secondary: 'rate' };
  }
  if (booking.status === 'cancelled') {
    return { primary: 'book_again' };
  }
  if (booking.status === 'rejected') {
    return { primary: 'book_again' };
  }
  if (booking.status === 'no_show') {
    return { primary: 'book_again' };
  }
  if (booking.status === 'pending' || booking.status === 'reschedule_requested') {
    return { primary: 'view_details', secondary: 'cancel' };
  }
  if (booking.status === 'confirmed') {
    return { primary: 'view_details', secondary: 'cancel' };
  }
  if (booking.status === 'on_the_way') {
    return { primary: 'track', secondary: 'contact' };
  }
  if (booking.status === 'provider_assigned') {
    return { primary: 'contact', secondary: 'view_details' };
  }

  if (booking.category === 'lab') {
    return { primary: 'prepare', secondary: 'view_details' };
  }

  if (booking.isOnline || booking.status === 'online_live') {
    if (mins <= 15 && mins >= -60) {
      return { primary: 'join_now', secondary: 'view_details' };
    }
    return { primary: 'view_details', secondary: 'reschedule' };
  }

  if (booking.isClass) {
    if (booking.isOnline && mins <= 15 && mins >= -60) {
      return { primary: 'join_now', secondary: 'view_details' };
    }
    return { primary: 'directions', secondary: 'view_details' };
  }

  if (booking.category === 'home_service') {
    return { primary: 'track', secondary: 'contact' };
  }

  if (booking.mode === 'center' || booking.category === 'hospital') {
    return { primary: 'directions', secondary: 'view_details' };
  }

  if (mins <= 15 && mins >= -60) {
    return { primary: 'join_now', secondary: 'view_details' };
  }

  return { primary: 'view_details', secondary: 'reschedule' };
}

export function filterBookings(
  items: ConsolidatedBooking[],
  filter: BookingFilter,
): ConsolidatedBooking[] {
  const booked = getBookedItems(items);
  if (filter === 'on_site') return booked.filter(b => !b.isOnline);
  if (filter === 'online') return booked.filter(b => b.isOnline);
  if (filter === 'classes') return booked.filter(b => b.isClass);
  return booked;
}

const HEALTH_CATEGORIES: BookingCategory[] = ['appointment', 'hospital', 'lab'];

function matchesTypeFilter(category: BookingCategory, types: BookingCategory[]): boolean {
  if (types.length === 0) return true;
  if (types.includes('appointment') && HEALTH_CATEGORIES.includes(category)) return true;
  return types.includes(category);
}

export function applyAdvancedFilters(
  items: ConsolidatedBooking[],
  filters: BookingAdvancedFilters,
  now = new Date(),
): ConsolidatedBooking[] {
  let result = items;

  if (filters.status === 'upcoming') {
    result = getUpcomingBookings(result, now);
  } else if (filters.status === 'completed') {
    result = result.filter(b => b.status === 'completed');
  } else if (filters.status === 'cancelled') {
    result = result.filter(b => b.status === 'cancelled');
  }

  if (filters.types.length > 0) {
    result = result.filter(b => matchesTypeFilter(b.category, filters.types));
  }

  if (filters.date === 'today') {
    result = result.filter(b => isToday(b.startsAt, now));
  } else if (filters.date === 'this_week') {
    result = result.filter(b => isThisWeek(b.startsAt, now));
  } else if (filters.date === 'this_month') {
    result = result.filter(b => isThisMonth(b.startsAt, now));
  }

  return result;
}

export function fitnessClassToBooking(item: FitnessClass): ConsolidatedBooking {
  const now = new Date();
  return {
    id: `class-${item.id}`,
    entityId: item.id,
    providerName: item.coach,
    serviceTitle: item.title,
    providerRole: item.location,
    startsAt: buildStartsAt(now, '5:30 AM', 1),
    locationLabel: item.location,
    mode: 'center',
    isOnline: false,
    isClass: true,
    category: 'class',
    status: 'upcoming',
    statusLabel: 'Available',
    visual: 'thumbnail',
    durationMinutes: 60,
    amount: item.fee,
    imageUrl: item.imageUrl,
    isReserved: false,
  };
}

export function navigateBookingTarget(
  navigation: { navigate: (screen: string, params?: object) => void },
  booking: ConsolidatedBooking,
) {
  if (booking.isReserved !== false) {
    navigation.navigate('BookingDetail', { bookingId: booking.id });
    return;
  }
  if (booking.category === 'class' || booking.isClass) {
    navigation.navigate('ClassDetail', {
      classId: booking.entityId ?? booking.id.replace(/^class-/, ''),
    });
    return;
  }
  if (booking.category === 'lab') {
    navigation.navigate('LabDetail', {
      labId: booking.entityId ?? 'lab-apollo',
      testId: booking.testId,
    });
    return;
  }
  if (
    (booking.category === 'appointment' || booking.category === 'hospital') &&
    booking.entityId
  ) {
    navigation.navigate('DoctorProfile', { doctorId: booking.entityId });
    return;
  }
  navigation.navigate('MyBookings');
}

export const BOOKING_ACTION_LABELS: Record<BookingAction, string> = {
  view_details: 'Details',
  join_now: 'Join Now',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  book_again: 'Book Again',
  directions: 'Directions',
  track: 'Track',
  contact: 'Contact',
  prepare: 'Prepare',
  rate: 'Rate Service',
};

export function getBookingWhenDisplay(booking: ConsolidatedBooking): string {
  if (booking.endsAt) {
    return formatBookingRange(booking.startsAt, booking.endsAt);
  }
  return formatBookingWhen(booking.startsAt);
}

export function getBookingSubtitle(booking: ConsolidatedBooking): string {
  if (booking.providerRole && booking.providerName) {
    return `${booking.providerName} · ${booking.providerRole}`;
  }
  return booking.providerName;
}

export const DEFAULT_ADVANCED_FILTERS: BookingAdvancedFilters = {
  status: null,
  types: [],
  date: null,
};

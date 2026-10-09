import { ServiceMode, FitnessClass } from '@/shared/types';
import { doctors, fitnessClasses, labs } from '@/shared/data/mocks';
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
  | 'pending';

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

const remya = doctors.find(d => d.id === 'doc-remya')!;
const sathish = doctors.find(d => d.id === 'doc-sathish')!;
const apollo = labs.find(l => l.id === 'lab-apollo')!;
const fitAm = fitnessClasses.find(c => c.id === 'fit-sathish-am')!;
const yogaImg = fitnessClasses[0]?.imageUrl;

function statusLabel(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    confirmed: 'Confirmed',
    upcoming: 'Upcoming',
    online_live: 'Online',
    provider_assigned: 'Provider Assigned',
    on_the_way: 'On the Way',
    completed: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Pending',
  };
  return labels[status];
}

function seedBookings(now: Date): ConsolidatedBooking[] {
  const today630pm = buildStartsAt(now, '6:30 PM', 0);
  const today1030am = buildStartsAt(now, '10:30 AM', 0);
  const today1030amEnd = buildStartsAt(now, '11:30 AM', 0);
  const tomorrow7am = buildStartsAt(now, '7:00 AM', 1);
  const tomorrow830am = buildStartsAt(now, '8:30 AM', 1);
  const tomorrow830amEnd = buildStartsAt(now, '9:00 AM', 1);
  const threeDays730pm = buildStartsAt(now, '7:30 PM', 3);
  const nextWeek10am = buildStartsAt(now, '10:00 AM', 5);
  const pastWeek = buildStartsAt(now, '5:30 AM', -3);
  const pastEvent = buildStartsAt(new Date('2026-04-12'), '6:00 AM', 0);

  return [
    {
      id: 'bk-remya',
      entityId: 'doc-remya',
      providerName: remya.name,
      serviceTitle: 'Online Consultation',
      providerRole: remya.specialty,
      startsAt: today630pm,
      locationLabel: 'Video consultation',
      mode: 'online',
      isOnline: true,
      isClass: false,
      category: 'appointment',
      status: 'confirmed',
      statusLabel: statusLabel('confirmed'),
      visual: 'avatar',
      amount: remya.fee,
      imageUrl: remya.imageUrl,
      isReserved: true,
    },
    {
      id: 'bk-ac',
      providerName: 'Kumar',
      serviceTitle: 'AC Repair',
      providerRole: 'AC Technician',
      startsAt: today1030am,
      endsAt: today1030amEnd,
      locationLabel: 'Home',
      mode: 'home',
      isOnline: false,
      isClass: false,
      category: 'home_service',
      status: 'on_the_way',
      statusLabel: statusLabel('on_the_way'),
      visual: 'icon',
      iconName: 'settings',
      etaMinutes: 18,
      amount: 499,
      isReserved: true,
    },
    {
      id: 'bk-yoga',
      entityId: 'fit-sathish-am',
      providerName: 'Meera',
      serviceTitle: 'Beginner Yoga',
      providerRole: 'Fit Studio',
      startsAt: tomorrow7am,
      locationLabel: 'Studio · 2.4 km',
      mode: 'center',
      isOnline: false,
      isClass: true,
      category: 'class',
      status: 'confirmed',
      statusLabel: statusLabel('confirmed'),
      visual: 'thumbnail',
      durationMinutes: 45,
      amount: 599,
      imageUrl: yogaImg,
      isReserved: true,
    },
    {
      id: 'bk-apollo-b12',
      entityId: 'lab-apollo',
      testId: 'test-b12',
      providerName: apollo.name,
      serviceTitle: 'Vitamin B12 Test',
      providerRole: 'Home collection',
      startsAt: tomorrow830am,
      endsAt: tomorrow830amEnd,
      locationLabel: 'Home collection',
      mode: 'home',
      isOnline: false,
      isClass: false,
      category: 'lab',
      status: 'confirmed',
      statusLabel: statusLabel('confirmed'),
      visual: 'logo',
      amount: 400,
      imageUrl: apollo.imageUrl,
      isReserved: true,
    },
    {
      id: 'bk-fitness-am',
      entityId: 'fit-sathish-am',
      providerName: fitAm.coach,
      serviceTitle: fitAm.title,
      providerRole: fitAm.location,
      startsAt: threeDays730pm,
      locationLabel: fitAm.location,
      mode: 'center',
      isOnline: false,
      isClass: true,
      category: 'class',
      status: 'upcoming',
      statusLabel: statusLabel('upcoming'),
      visual: 'thumbnail',
      durationMinutes: 60,
      amount: fitAm.fee,
      imageUrl: fitAm.imageUrl,
      isReserved: true,
    },
    {
      id: 'bk-hospital',
      entityId: 'doc-sathish',
      providerName: 'Apollo Hospitals',
      serviceTitle: 'Orthopedic Consultation',
      providerRole: sathish.specialty,
      startsAt: nextWeek10am,
      locationLabel: 'Greams Road · Chennai',
      mode: 'center',
      isOnline: false,
      isClass: false,
      category: 'hospital',
      status: 'confirmed',
      statusLabel: statusLabel('confirmed'),
      visual: 'logo',
      amount: 500,
      imageUrl: apollo.imageUrl,
      isReserved: true,
    },
    {
      id: 'bk-event',
      providerName: 'TrailBlaze Tours',
      serviceTitle: 'Yercaud Weekend Adventure',
      startsAt: pastEvent,
      locationLabel: 'CMBTA Bus Stand',
      isOnline: false,
      isClass: false,
      category: 'event',
      status: 'upcoming',
      statusLabel: statusLabel('upcoming'),
      visual: 'thumbnail',
      amount: 3499,
      imageUrl: yogaImg,
      isReserved: true,
    },
    {
      id: 'bk-physio-past',
      entityId: 'doc-sathish',
      providerName: sathish.name,
      serviceTitle: 'Sports Physiotherapy',
      providerRole: sathish.specialty,
      startsAt: pastWeek,
      locationLabel: 'Knock Clinic',
      mode: 'center',
      isOnline: false,
      isClass: false,
      category: 'appointment',
      status: 'completed',
      statusLabel: statusLabel('completed'),
      visual: 'avatar',
      amount: sathish.fee,
      imageUrl: sathish.imageUrl,
      isReserved: true,
    },
    {
      id: 'bk-online-music',
      providerName: 'Arun',
      serviceTitle: 'Guitar Basics',
      providerRole: 'Music Academy',
      startsAt: buildStartsAt(now, '7:30 PM', 2),
      locationLabel: 'Online',
      mode: 'online',
      isOnline: true,
      isClass: true,
      category: 'class',
      status: 'confirmed',
      statusLabel: statusLabel('confirmed'),
      visual: 'thumbnail',
      durationMinutes: 60,
      amount: 799,
      imageUrl: yogaImg,
      isReserved: true,
    },
  ];
}

let cachedSeed: ConsolidatedBooking[] | null = null;

export function getConsolidatedBookings(now = new Date()): ConsolidatedBooking[] {
  if (!cachedSeed) {
    cachedSeed = seedBookings(now);
  }
  return cachedSeed.map(b => ({ ...b }));
}

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
    b => !isPastBooking(b.startsAt, now) && b.status !== 'completed' && b.status !== 'cancelled',
  );
}

export function getPastBookings(
  items: ConsolidatedBooking[],
  now = new Date(),
): ConsolidatedBooking[] {
  return getBookedItems(items).filter(
    b => isPastBooking(b.startsAt, now) || b.status === 'completed' || b.status === 'cancelled',
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

  if (booking.status === 'completed') {
    return { primary: 'book_again', secondary: 'rate' };
  }
  if (booking.status === 'cancelled') {
    return { primary: 'book_again' };
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

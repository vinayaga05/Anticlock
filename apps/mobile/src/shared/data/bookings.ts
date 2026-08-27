import { ServiceMode } from '@/shared/types';
import { bookings } from '@/shared/data/mocks';
import { getUniversalBookings } from '@/shared/data/services';

export type BookingFilter = 'all' | 'online' | 'all_class';

export type BookingAction = 'view_details' | 'join_now' | 'reschedule' | 'cancel' | 'book_again';

export type BookingCategory =
  | 'appointment'
  | 'class'
  | 'home_service'
  | 'lab'
  | 'event'
  | 'other';

export type ConsolidatedBooking = {
  id: string;
  providerName: string;
  serviceTitle: string;
  whenLabel: string;
  locationLabel?: string;
  mode?: ServiceMode;
  isOnline: boolean;
  isClass: boolean;
  category: BookingCategory;
  status: string;
  statusLabel: string;
  actions: BookingAction[];
  amount?: number;
};

const PRIMARY_BOOKINGS: ConsolidatedBooking[] = [
  {
    id: 'bk-ananya',
    providerName: 'Dr. Ananya',
    serviceTitle: 'Physiotherapy Consultation',
    whenLabel: 'Today · 6:30 PM',
    locationLabel: 'Online',
    mode: 'online',
    isOnline: true,
    isClass: false,
    category: 'appointment',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    actions: ['view_details', 'join_now'],
    amount: 700,
  },
  {
    id: 'bk-fitness',
    providerName: 'Coach Sathish Kumar',
    serviceTitle: 'Sports Fitness Training',
    whenLabel: 'Tomorrow · 5:30 AM',
    locationLabel: 'Class',
    mode: 'center',
    isOnline: false,
    isClass: true,
    category: 'class',
    status: 'booked',
    statusLabel: 'Booked',
    actions: ['view_details'],
    amount: 399,
  },
  {
    id: 'bk-ac',
    providerName: 'Home Service',
    serviceTitle: 'AC Repair',
    whenLabel: 'Aug 29 · 10:00 AM',
    mode: 'home',
    isOnline: false,
    isClass: false,
    category: 'home_service',
    status: 'provider_assigned',
    statusLabel: 'Provider Assigned',
    actions: ['view_details'],
    amount: 499,
  },
  {
    id: 'bk-yoga',
    providerName: 'Yoga with Meera',
    serviceTitle: 'Beginner Yoga Program',
    whenLabel: 'Sat · 7:00 AM',
    locationLabel: 'Online',
    mode: 'online',
    isOnline: true,
    isClass: true,
    category: 'class',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    actions: ['view_details', 'join_now'],
    amount: 599,
  },
  {
    id: 'bk-lab',
    providerName: 'Thyrocare Diagnostics',
    serviceTitle: 'Vitamin B12 Panel',
    whenLabel: 'Fri · 8:00 AM',
    locationLabel: 'Home collection',
    mode: 'home',
    isOnline: false,
    isClass: false,
    category: 'lab',
    status: 'upcoming',
    statusLabel: 'Upcoming',
    actions: ['view_details', 'reschedule', 'cancel'],
    amount: 450,
  },
];

function mapLegacyBooking(b: (typeof bookings)[0]): ConsolidatedBooking {
  const isClass = b.kind === 'fitness';
  const isOnline = /online/i.test(b.place);
  return {
    id: b.id,
    providerName: b.title,
    serviceTitle: b.subtitle,
    whenLabel: b.when,
    locationLabel: isOnline ? 'Online' : b.place,
    mode: isOnline ? 'online' : 'center',
    isOnline,
    isClass,
    category: isClass ? 'class' : b.kind === 'lab' ? 'lab' : 'appointment',
    status: b.status,
    statusLabel: b.status.charAt(0).toUpperCase() + b.status.slice(1),
    actions: isOnline ? ['view_details', 'join_now'] : ['view_details'],
    amount: b.amountPaid,
  };
}

function mapUniversalBooking(b: ReturnType<typeof getUniversalBookings>[0]): ConsolidatedBooking {
  const isClass = b.type === 'class_booking';
  const isOnline = /online/i.test(b.place ?? '');
  const isEvent = b.type === 'event_booking';
  return {
    id: b.id,
    providerName: b.subtitle ?? b.title,
    serviceTitle: b.subtitle ? b.title : 'Booking',
    whenLabel: [b.date, b.time].filter(Boolean).join(' · ') || 'Scheduled',
    locationLabel: isOnline ? 'Online' : isClass ? 'Class' : b.place,
    mode: isOnline ? 'online' : undefined,
    isOnline,
    isClass,
    category: isClass ? 'class' : isEvent ? 'event' : 'appointment',
    status: b.status,
    statusLabel: b.status.charAt(0).toUpperCase() + b.status.slice(1),
    actions: ['view_details'],
    amount: b.price,
  };
}

export function getConsolidatedBookings(): ConsolidatedBooking[] {
  const legacy = bookings.map(mapLegacyBooking);
  const universal = getUniversalBookings().map(mapUniversalBooking);
  const seen = new Set<string>();
  const merged: ConsolidatedBooking[] = [];

  for (const item of [...PRIMARY_BOOKINGS, ...legacy, ...universal]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

export function filterBookings(
  items: ConsolidatedBooking[],
  filter: BookingFilter,
): ConsolidatedBooking[] {
  if (filter === 'online') return items.filter(b => b.isOnline);
  if (filter === 'all_class') return items.filter(b => b.isClass);
  return items;
}

export const BOOKING_ACTION_LABELS: Record<BookingAction, string> = {
  view_details: 'View Details',
  join_now: 'Join Now',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  book_again: 'Book Again',
};

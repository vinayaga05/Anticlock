import { ServiceMode, FitnessClass } from '@/shared/types';
import { bookings, doctors, fitnessClasses, labs } from '@/shared/data/mocks';
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
  imageUrl?: string;
  subtitle?: string;
  detailLines?: string[];
  experienceYears?: number;
  rating?: number;
  isLive?: boolean;
  scheduleLabel?: string;
  entityId?: string;
  testId?: string;
};

const remya = doctors.find(d => d.id === 'doc-remya')!;
const apollo = labs.find(l => l.id === 'lab-apollo')!;
const fitAm = fitnessClasses.find(c => c.id === 'fit-sathish-am')!;
const fitBand = fitnessClasses.find(c => c.id === 'fit-band')!;

const PRIMARY_BOOKINGS: ConsolidatedBooking[] = [
  {
    id: 'bk-remya',
    entityId: 'doc-remya',
    providerName: 'Dr. Remya',
    serviceTitle: 'General Physician Consultation',
    subtitle: 'MBBS',
    detailLines: ['General Physician', 'Tamil, English, Telugu'],
    whenLabel: '22 Oct · 6:30 PM',
    locationLabel: 'Online',
    mode: 'online',
    isOnline: true,
    isClass: false,
    category: 'appointment',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    actions: ['view_details', 'join_now'],
    amount: 300,
    imageUrl: remya.imageUrl,
    experienceYears: 8,
    rating: remya.rating,
    isLive: true,
  },
  {
    id: 'bk-fitness-am',
    entityId: 'fit-sathish-am',
    providerName: 'Sathish Kumar',
    serviceTitle: 'Sports Fitness Training',
    whenLabel: '22 Oct · 5:30 AM',
    scheduleLabel: 'Daily · 5:30 AM · 60 Min',
    locationLabel: 'ASP Gym',
    mode: 'center',
    isOnline: false,
    isClass: true,
    category: 'class',
    status: 'booked',
    statusLabel: 'Booked',
    actions: ['view_details', 'join_now'],
    amount: fitAm.fee,
    imageUrl: fitAm.imageUrl,
  },
  {
    id: 'bk-apollo-b12',
    entityId: 'lab-apollo',
    testId: 'test-b12',
    providerName: 'Apollo Diagnostics',
    serviceTitle: 'Vitamin B12',
    detailLines: ['Tambaram', 'Vitamin B12', 'Center collection'],
    whenLabel: '22 Oct · 6:30 PM',
    locationLabel: 'Tambaram',
    mode: 'center',
    isOnline: false,
    isClass: false,
    category: 'lab',
    status: 'booked',
    statusLabel: 'Booked',
    actions: ['view_details', 'cancel'],
    amount: 400,
    imageUrl: apollo.imageUrl,
    experienceYears: 8,
    rating: apollo.rating,
  },
  {
    id: 'bk-fitness-alt',
    entityId: 'fit-band',
    providerName: 'Sathish Kumar',
    serviceTitle: 'Sports Fitness Training',
    whenLabel: 'Alt. Day · 5:30 AM',
    scheduleLabel: 'Alt. Day · 5:30 AM · 45 Min',
    locationLabel: 'ASP Gym',
    mode: 'center',
    isOnline: false,
    isClass: true,
    category: 'class',
    status: 'open',
    statusLabel: 'Available',
    actions: ['view_details', 'join_now'],
    amount: fitBand.fee,
    imageUrl: fitBand.imageUrl,
  },
  {
    id: 'bk-yoga',
    entityId: 'fit-sathish-am',
    providerName: 'Meera',
    serviceTitle: 'Beginner Yoga Program',
    whenLabel: 'Sat · 7:00 AM',
    scheduleLabel: 'Sat · 7:00 AM · 45 Min',
    locationLabel: 'Online',
    mode: 'online',
    isOnline: true,
    isClass: true,
    category: 'class',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    actions: ['view_details', 'join_now'],
    amount: 599,
    imageUrl: fitnessClasses[0].imageUrl,
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

export function fitnessClassToBooking(item: FitnessClass): ConsolidatedBooking {
  return {
    id: `class-${item.id}`,
    entityId: item.id,
    providerName: item.coach,
    serviceTitle: item.title,
    whenLabel: item.schedule,
    scheduleLabel: item.schedule,
    locationLabel: item.location,
    mode: 'center',
    isOnline: false,
    isClass: true,
    category: 'class',
    status: 'open',
    statusLabel: 'Available',
    actions: ['view_details', 'join_now'],
    amount: item.fee,
    imageUrl: item.imageUrl,
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
  if (booking.category === 'appointment' && booking.entityId) {
    navigation.navigate('DoctorProfile', { doctorId: booking.entityId });
    return;
  }
  navigation.navigate('MyBookings');
}

export const BOOKING_ACTION_LABELS: Record<BookingAction, string> = {
  view_details: 'View Details',
  join_now: 'Join Now',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  book_again: 'Book Again',
};

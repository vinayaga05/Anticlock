import type { Booking } from '@anticlock/contracts';
import type { ConsolidatedBooking, BookingStatus, BookingCategory } from './bookings';

export function mapApiBookingToConsolidated(booking: Booking): ConsolidatedBooking {
  const detail = booking.detail;
  
  return {
    id: booking.id,
    providerName: detail.providerName || 'Provider',
    serviceTitle: detail.serviceTitle,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt || undefined,
    locationLabel: detail.locationLabel,
    mode: booking.serviceMode,
    isOnline: booking.serviceMode === 'online',
    isClass: booking.category === 'class',
    category: booking.category as BookingCategory,
    status: mapBookingStatus(booking.status),
    statusLabel: getStatusLabel(booking.status),
    visual: getVisualType(booking.category, detail),
    providerRole: detail.providerRole,
    durationMinutes: booking.durationMinutes || undefined,
    amount: booking.amount || undefined,
    imageUrl: detail.imageUrl,
    iconName: detail.iconName,
    isReserved: true,
  };
}

function mapBookingStatus(status: string): BookingStatus {
  const statusMap: Record<string, BookingStatus> = {
    pending: 'pending',
    confirmed: 'confirmed',
    provider_assigned: 'provider_assigned',
    on_the_way: 'on_the_way',
    in_progress: 'upcoming',
    completed: 'completed',
    cancelled: 'cancelled',
    no_show: 'cancelled',
  };
  return (statusMap[status] as BookingStatus) || 'upcoming';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    provider_assigned: 'Provider Assigned',
    on_the_way: 'On the Way',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  };
  return labels[status] || 'Upcoming';
}

function getVisualType(
  category: string,
  detail: Booking['detail'],
): ConsolidatedBooking['visual'] {
  if (detail.imageUrl) {
    if (category === 'class') return 'thumbnail';
    if (category === 'lab' || category === 'hospital') return 'logo';
    return 'avatar';
  }
  if (detail.iconName) return 'icon';
  return 'avatar';
}

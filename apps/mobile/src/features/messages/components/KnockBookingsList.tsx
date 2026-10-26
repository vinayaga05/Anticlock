import React from 'react';
import { BookingsTimeline } from '@/features/booking/components/BookingsTimeline';

/** @deprecated Use BookingsTimeline directly. */
export function KnockBookingsList({ searchQuery = '' }: { searchQuery?: string }) {
  return <BookingsTimeline searchQuery={searchQuery} />;
}

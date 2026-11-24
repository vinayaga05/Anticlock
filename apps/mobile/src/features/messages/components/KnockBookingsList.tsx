import React from 'react';
import { BookingsTimeline } from '@/features/booking/components/BookingsTimeline';

/** @deprecated Use BookingsTimeline directly. */
export function KnockBookingsList({ searchQuery = '', genieActive, onGenieQuery }: {
  searchQuery?: string; genieActive?: boolean; onGenieQuery?: (query:string)=>void;
}) {
  return <BookingsTimeline searchQuery={searchQuery} genieActive={genieActive} onGenieQuery={onGenieQuery} />;
}

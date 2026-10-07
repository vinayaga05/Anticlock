import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Booking,
  CreateBookingRequest,
  UpdateBookingRequest,
  CancelBookingRequest,
} from '@anticlock/contracts';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';

function ensureAuthToken() {
  const session = readStoredSession();
  if (!session?.token) {
    throw new Error('Not authenticated');
  }
}

export function useBookingsQuery(status?: 'upcoming' | 'past' | 'all') {
  const session = readStoredSession();
  const canFetch = isApiEnabled && Boolean(session?.token);

  return useQuery({
    queryKey: ['bookings', status ?? 'all', canFetch ? 'api' : 'mock'],
    queryFn: async () => {
      // No bearer token: do not call the API (BookingsTimeline falls back to mocks).
      if (!canFetch) {
        return { bookings: [], nextCursor: null };
      }
      const qs = status && status !== 'all' ? `?status=${status}` : '';
      const res = await apiRequest<{ bookings: Booking[]; nextCursor: string | null }>(
        `/v1/bookings${qs}`,
      );
      return res;
    },
    staleTime: canFetch ? 30_000 : Infinity,
  });
}

export function useBookingQuery(bookingId: string) {
  return useQuery({
    queryKey: ['bookings', bookingId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(`/v1/bookings/${bookingId}`);
      return res.booking;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
  });
}

export function useCreateBookingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateBookingRequest) => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>('/v1/bookings', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useUpdateBookingMutation(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: UpdateBookingRequest) => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(`/v1/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify(request),
      });
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['bookings', bookingId] });
    },
  });
}

export function useCancelBookingMutation(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: CancelBookingRequest) => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(
        `/v1/bookings/${bookingId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        },
      );
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['bookings', bookingId] });
    },
  });
}

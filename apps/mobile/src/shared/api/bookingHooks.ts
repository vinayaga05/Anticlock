import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Booking,
  BookingListFilter,
  BookingListResponse,
  CreateBookingRequest,
  CustomerUpdateBookingRequest,
  CancelBookingRequest,
  CustomerRescheduleBookingRequest,
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

export function useBookingsQuery(filter: BookingListFilter = 'all') {
  const session = readStoredSession();
  const canFetch = isApiEnabled && Boolean(session?.token);

  return useInfiniteQuery({
    queryKey: ['bookings', 'list', filter],
    enabled: canFetch,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      ensureAuthToken();
      const params = new URLSearchParams({ filter, limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      return apiRequest<BookingListResponse>(
        `/v1/bookings?${params.toString()}`,
      );
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useBookingQuery(bookingId: string) {
  const canFetch = isApiEnabled && Boolean(readStoredSession()?.token);
  return useQuery({
    queryKey: ['bookings', 'detail', bookingId],
    enabled: canFetch && Boolean(bookingId),
    queryFn: async () => {
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(`/v1/bookings/${bookingId}`);
      return res.booking;
    },
    staleTime: 30_000,
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
    mutationFn: async (request: CustomerUpdateBookingRequest) => {
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

export function useCancelAnyBookingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      ...request
    }: CancelBookingRequest & { bookingId: string }) => {
      if (!isApiEnabled) throw new Error('API not enabled');
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(
        `/v1/bookings/${bookingId}/cancel`,
        { method: 'POST', body: JSON.stringify(request) },
      );
      return res.booking;
    },
    onSuccess: booking => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['bookings', booking.id] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCustomerRescheduleBookingMutation(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: CustomerRescheduleBookingRequest) => {
      if (!isApiEnabled) throw new Error('API not enabled');
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(
        `/v1/bookings/${bookingId}/reschedule`,
        { method: 'POST', body: JSON.stringify(request) },
      );
      return res.booking;
    },
    onSuccess: booking => {
      qc.setQueryData(['bookings', 'detail', booking.id], booking);
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useConfirmCustomerRescheduleMutation(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) throw new Error('API not enabled');
      await ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(
        `/v1/bookings/${bookingId}/confirm-reschedule`,
        { method: 'POST' },
      );
      return res.booking;
    },
    onSuccess: booking => {
      qc.setQueryData(['bookings', 'detail', booking.id], booking);
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Trip,
  TripWithImages,
  TripBooking,
  TripBookingWithTrip,
  CreateTripBookingRequest,
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

export function useTripsQuery(options?: { destination?: string; difficulty?: string }) {
  return useQuery({
    queryKey: [
      'trips',
      'trips',
      options?.destination ?? 'all',
      options?.difficulty ?? 'all',
      isApiEnabled ? 'api' : 'mock',
    ],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { trips: [], nextCursor: null };
      }
      await ensureAuthToken();
      const params = new URLSearchParams();
      params.append('status', 'published');
      if (options?.destination) params.append('destination', options.destination);
      if (options?.difficulty) params.append('difficulty', options.difficulty);
      
      const res = await apiRequest<{ trips: Trip[]; nextCursor: string | null }>(
        `/v1/trips/trips?${params.toString()}`,
      );
      return res;
    },
    staleTime: isApiEnabled ? 60_000 : Infinity,
  });
}

export function useTripQuery(tripId: string) {
  return useQuery({
    queryKey: ['trips', 'trips', tripId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ trip: TripWithImages }>(
        `/v1/trips/trips/${tripId}`,
      );
      return res.trip;
    },
    staleTime: isApiEnabled ? 60_000 : Infinity,
  });
}

export function useTripBookingsQuery(status?: 'pending' | 'confirmed' | 'completed' | 'cancelled') {
  return useQuery({
    queryKey: ['trips', 'bookings', status ?? 'all', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { bookings: [], nextCursor: null };
      }
      await ensureAuthToken();
      const qs = status ? `?status=${status}` : '';
      const res = await apiRequest<{
        bookings: TripBookingWithTrip[];
        nextCursor: string | null;
      }>(`/v1/trips/trip-bookings${qs}`);
      return res;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
  });
}

export function useTripBookingQuery(bookingId: string) {
  return useQuery({
    queryKey: ['trips', 'bookings', bookingId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: TripBookingWithTrip }>(
        `/v1/trips/trip-bookings/${bookingId}`,
      );
      return res.booking;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
  });
}

export function useCreateTripBookingMutation(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: Omit<CreateTripBookingRequest, 'tripId'>) => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: TripBooking }>(
        `/v1/trips/trips/${tripId}/book`,
        {
          method: 'POST',
          body: JSON.stringify({ ...request, tripId }),
        },
      );
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', 'bookings'] });
    },
  });
}

export function useCancelTripBookingMutation(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ booking: TripBooking }>(
        `/v1/trips/trip-bookings/${bookingId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', 'bookings'] });
      qc.invalidateQueries({ queryKey: ['trips', 'bookings', bookingId] });
    },
  });
}

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { startLiveBookings, subscribeLiveBookings } from './bookingStream';

export function LiveBookingSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const stop = startLiveBookings();
    const unsubscribe = subscribeLiveBookings(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'business'] }),
      ]);
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, [queryClient]);

  return null;
}

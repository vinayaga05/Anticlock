import { Hono } from 'hono';
import {
  CreateTripBookingRequestSchema,
  CreateTripRequestSchema,
  TripBookingAdminQuerySchema,
  TripBookingListQuerySchema,
  TripListQuerySchema,
  UpdateTripBookingRequestSchema,
  UpdateTripRequestSchema,
} from '@anticlock/contracts';
import { tripService } from '../trips/TripService.js';
import { tripBookingService } from '../trips/TripBookingService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';
import { httpError } from '../lib/httpError.js';

function requireMobileAuth(c: { get: (k: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth;
}

export const tripsMobileRoutes = new Hono<AppEnv>();
tripsMobileRoutes.use('*', requireAuth);

// List published trips
tripsMobileRoutes.get('/trips', async c => {
  try {
    const query = {
      destination: c.req.query('destination'),
      difficulty: c.req.query('difficulty'),
      status: 'published',
      search: c.req.query('search'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = TripListQuerySchema.parse(query);
    const result = await tripService.listTrips(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'trips');
    return c.json(body, status);
  }
});

// Get trip detail
tripsMobileRoutes.get('/trips/:id', async c => {
  try {
    const trip = await tripService.getTripWithImages(c.req.param('id'));
    if (!trip || trip.status !== 'published') {
      return c.json(
        { error: { code: 'not_found', message: 'Trip not found' } },
        404,
      );
    }
    return c.json({ trip });
  } catch (err) {
    const { status, body } = httpError(err, 'trips');
    return c.json(body, status);
  }
});

// Create trip booking
tripsMobileRoutes.post('/trips/:id/book', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateTripBookingRequestSchema.parse(await c.req.json());
    
    // Validate trip ID matches
    if (body.tripId !== c.req.param('id')) {
      return c.json(
        { error: { code: 'invalid_request', message: 'Trip ID mismatch' } },
        400,
      );
    }

    const booking = await tripBookingService.createBooking(auth.sub, body);
    return c.json({ booking }, 201);
  } catch (err) {
    const { status, body } = httpError(err, 'trips');
    return c.json(body, status);
  }
});

// List user's trip bookings
tripsMobileRoutes.get('/trip-bookings', async c => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      status: c.req.query('status'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = TripBookingListQuerySchema.parse(query);
    const result = await tripBookingService.listBookings(auth.sub, validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'trips');
    return c.json(body, status);
  }
});

// Get booking detail
tripsMobileRoutes.get('/trip-bookings/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const booking = await tripBookingService.getBookingWithTrip(
      c.req.param('id'),
      auth.sub,
    );
    if (!booking) {
      return c.json(
        { error: { code: 'not_found', message: 'Booking not found' } },
        404,
      );
    }
    return c.json({ booking });
  } catch (err) {
    const { status, body } = httpError(err, 'trips');
    return c.json(body, status);
  }
});

// Cancel booking
tripsMobileRoutes.post('/trip-bookings/:id/cancel', async c => {
  try {
    const auth = requireMobileAuth(c);
    const booking = await tripBookingService.cancelBooking(
      c.req.param('id'),
      auth.sub,
    );
    if (!booking) {
      return c.json(
        {
          error: {
            code: 'not_found',
            message: 'Booking not found or cannot be cancelled',
          },
        },
        404,
      );
    }
    return c.json({ booking });
  } catch (err) {
    const { status, body } = httpError(err, 'trips');
    return c.json(body, status);
  }
});

export const tripsAdminRoutes = new Hono<AppEnv>();
tripsAdminRoutes.use('*', requireAuth);

// Trips Admin
tripsAdminRoutes.get(
  '/trips',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        destination: c.req.query('destination'),
        difficulty: c.req.query('difficulty'),
        status: c.req.query('status'),
        search: c.req.query('search'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = TripListQuerySchema.parse(query);
      const result = await tripService.listTrips(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

tripsAdminRoutes.get(
  '/trips/:id',
  requirePermission('catalog.read'),
  async c => {
    try {
      const trip = await tripService.getTripWithImages(c.req.param('id'));
      if (!trip) {
        return c.json(
          { error: { code: 'not_found', message: 'Trip not found' } },
          404,
        );
      }
      return c.json({ trip });
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

tripsAdminRoutes.post(
  '/trips',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = CreateTripRequestSchema.parse(await c.req.json());
      const trip = await tripService.createTrip(body);
      return c.json({ trip }, 201);
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

tripsAdminRoutes.patch(
  '/trips/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateTripRequestSchema.parse(await c.req.json());
      const trip = await tripService.updateTrip(c.req.param('id'), body);
      if (!trip) {
        return c.json(
          { error: { code: 'not_found', message: 'Trip not found' } },
          404,
        );
      }
      return c.json({ trip });
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

tripsAdminRoutes.delete(
  '/trips/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const deleted = await tripService.deleteTrip(c.req.param('id'));
      if (!deleted) {
        return c.json(
          { error: { code: 'not_found', message: 'Trip not found' } },
          404,
        );
      }
      return c.json({ ok: true });
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

// Trip Bookings Admin
tripsAdminRoutes.get(
  '/trip-bookings',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        userId: c.req.query('userId'),
        tripId: c.req.query('tripId'),
        status: c.req.query('status'),
        from: c.req.query('from'),
        to: c.req.query('to'),
        search: c.req.query('search'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = TripBookingAdminQuerySchema.parse(query);
      const result = await tripBookingService.listBookingsAdmin(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

tripsAdminRoutes.get(
  '/trip-bookings/:id',
  requirePermission('catalog.read'),
  async c => {
    try {
      const booking = await tripBookingService.getBookingAdmin(c.req.param('id'));
      if (!booking) {
        return c.json(
          { error: { code: 'not_found', message: 'Booking not found' } },
          404,
        );
      }
      return c.json({ booking });
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

tripsAdminRoutes.patch(
  '/trip-bookings/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateTripBookingRequestSchema.parse(await c.req.json());
      const booking = await tripBookingService.updateBookingAdmin(
        c.req.param('id'),
        body,
      );
      if (!booking) {
        return c.json(
          { error: { code: 'not_found', message: 'Booking not found' } },
          404,
        );
      }
      return c.json({ booking });
    } catch (err) {
      const { status, body } = httpError(err, 'trips');
      return c.json(body, status);
    }
  },
);

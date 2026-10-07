import { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  BookingAdminQuerySchema,
  BookingListQuerySchema,
  CancelBookingRequestSchema,
  CreateBookingRequestSchema,
  UpdateBookingRequestSchema,
} from '@anticlock/contracts';
import { bookingService } from '../booking/BookingService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';

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

function httpError(err: unknown) {
  if (err instanceof ZodError) {
    return {
      status: 400 as const,
      body: { error: { code: 'invalid_request', message: err.issues[0]?.message ?? 'Invalid request' } },
    };
  }
  const e = err as { status?: number; code?: string; message?: string };
  return {
    status: (e.status ?? 500) as 400 | 403 | 404 | 409 | 500,
    body: {
      error: {
        code: e.code ?? 'error',
        message: e.message ?? 'Unexpected error',
      },
    },
  };
}

export const bookingMobileRoutes = new Hono<AppEnv>();
bookingMobileRoutes.use('*', requireAuth);

bookingMobileRoutes.post('/', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateBookingRequestSchema.parse(await c.req.json());
    const booking = await bookingService.createBooking(auth.sub, body);
    return c.json({ booking }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

bookingMobileRoutes.get('/', async c => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      status: c.req.query('status'),
      category: c.req.query('category'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = BookingListQuerySchema.parse(query);
    const result = await bookingService.listBookings(auth.sub, validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

bookingMobileRoutes.get('/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const booking = await bookingService.getBooking(c.req.param('id'), auth.sub);
    if (!booking) {
      return c.json(
        { error: { code: 'not_found', message: 'Booking not found' } },
        404,
      );
    }
    return c.json({ booking });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

bookingMobileRoutes.patch('/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = UpdateBookingRequestSchema.parse(await c.req.json());
    const booking = await bookingService.updateBooking(
      c.req.param('id'),
      auth.sub,
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
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

bookingMobileRoutes.post('/:id/cancel', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = CancelBookingRequestSchema.parse(await c.req.json());
    const booking = await bookingService.cancelBooking(
      c.req.param('id'),
      auth.sub,
      body.reason,
    );
    if (!booking) {
      return c.json(
        { error: { code: 'not_found', message: 'Booking not found or cannot be cancelled' } },
        404,
      );
    }
    return c.json({ booking });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const bookingAdminRoutes = new Hono<AppEnv>();
bookingAdminRoutes.use('*', requireAuth);

bookingAdminRoutes.get(
  '/',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        userId: c.req.query('userId'),
        providerId: c.req.query('providerId'),
        status: c.req.query('status'),
        from: c.req.query('from'),
        to: c.req.query('to'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = BookingAdminQuerySchema.parse(query);
      const result = await bookingService.listBookingsAdmin(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

bookingAdminRoutes.get(
  '/:id',
  requirePermission('catalog.read'),
  async c => {
    try {
      const booking = await bookingService.getBookingAdmin(c.req.param('id'));
      if (!booking) {
        return c.json(
          { error: { code: 'not_found', message: 'Booking not found' } },
          404,
        );
      }
      return c.json({ booking });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

bookingAdminRoutes.patch(
  '/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateBookingRequestSchema.parse(await c.req.json());
      const booking = await bookingService.updateBookingAdmin(
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
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

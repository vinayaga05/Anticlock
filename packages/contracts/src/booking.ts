import { z } from 'zod';
import { PaymentStatusSchema, type PaymentStatus } from './payment.js';

export const BookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'rejected',
  'reschedule_requested',
  'completed',
  'cancelled',
  'no_show',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingCategorySchema = z.enum([
  'appointment',
  'class',
  'home_service',
  'lab',
  'event',
  'hospital',
  'other',
]);
export type BookingCategory = z.infer<typeof BookingCategorySchema>;

export const ServiceModeSchema = z.enum(['online', 'center', 'home']);
export type ServiceMode = z.infer<typeof ServiceModeSchema>;

export const BookingModeSchema = z.enum(['on_site', 'online']);
export type BookingMode = z.infer<typeof BookingModeSchema>;

export const BookingTypeSchema = z.enum([
  'appointment',
  'class',
  'group_session',
  'course',
  'workshop',
  'home_service',
  'lab',
  'event',
  'hospital',
  'other',
]);
export type BookingType = z.infer<typeof BookingTypeSchema>;

export const BookingListFilterSchema = z.enum([
  'all',
  'on_site',
  'online',
  'classes',
]);
export type BookingListFilter = z.infer<typeof BookingListFilterSchema>;


export const BookingDetailSchema = z.object({
  providerName: z.string().optional(),
  providerRole: z.string().optional(),
  serviceTitle: z.string(),
  locationLabel: z.string().optional(),
  address: z.string().optional(),
  mapLatitude: z.number().min(-90).max(90).optional(),
  mapLongitude: z.number().min(-180).max(180).optional(),
  imageUrl: z.string().url().optional(),
  iconName: z.string().optional(),
  notes: z.string().optional(),
});
export type BookingDetail = z.infer<typeof BookingDetailSchema>;

export const BookingSchema = z.object({
  id: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  providerId: z.string().uuid().nullable(),
  categoryId: z.string().nullable(),
  category: BookingCategorySchema,
  bookingMode: BookingModeSchema,
  bookingType: BookingTypeSchema,
  viewerRole: z.enum(['customer', 'provider']),
  customerName: z.string().optional(),
  status: BookingStatusSchema,
  serviceMode: ServiceModeSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  amount: z.number().int().nonnegative().nullable(),
  paymentStatus: PaymentStatusSchema,
  detail: BookingDetailSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type Booking = z.infer<typeof BookingSchema>;

export const CreateBookingRequestSchema = z.object({
  providerId: z.string().uuid(),
  categoryId: z.string().min(1),
  category: BookingCategorySchema,
  bookingType: BookingTypeSchema.optional(),
  serviceMode: ServiceModeSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  amount: z.number().int().nonnegative().nullable().optional(),
  detail: BookingDetailSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const UpdateBookingRequestSchema = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: BookingStatusSchema.optional(),
  amount: z.number().int().nonnegative().nullable().optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  detail: BookingDetailSchema.partial().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ProviderBookingActionSchema = z.enum([
  'accept',
  'reject',
  'reschedule',
  'complete',
  'no_show',
]);
export type ProviderBookingAction = z.infer<typeof ProviderBookingActionSchema>;

export const ProviderBookingActionRequestSchema = z.object({
  action: ProviderBookingActionSchema,
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  reason: z.string().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.action === 'reschedule' && !value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startsAt'],
      message: 'Choose a new date and time',
    });
  }
});
export type ProviderBookingActionRequest = z.infer<
  typeof ProviderBookingActionRequestSchema
>;
export type UpdateBookingRequest = z.infer<typeof UpdateBookingRequestSchema>;

/** Customer edits never include lifecycle, price, payment, or schedule. */
export const CustomerUpdateBookingRequestSchema = z.object({
  detail: z.object({
    notes: z.string().max(1000).optional(),
    locationLabel: z.string().max(500).optional(),
  }).strict(),
}).strict();
export type CustomerUpdateBookingRequest = z.infer<
  typeof CustomerUpdateBookingRequestSchema
>;

export const CancelBookingRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;

export const CustomerRescheduleBookingRequestSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  reason: z.string().max(500).optional(),
});
export type CustomerRescheduleBookingRequest = z.infer<
  typeof CustomerRescheduleBookingRequestSchema
>;

export const BookingListQuerySchema = z.object({
  status: z
    .union([BookingStatusSchema, z.literal('upcoming'), z.literal('past')])
    .optional(),
  category: BookingCategorySchema.optional(),
  filter: BookingListFilterSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;

export const BookingListResponseSchema = z.object({
  bookings: z.array(BookingSchema),
  nextCursor: z.string().nullable(),
  counts: z.object({
    all: z.number().int().nonnegative(),
    onSite: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
    classes: z.number().int().nonnegative(),
  }),
});
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;

export const BookingAdminListItemSchema = BookingSchema.extend({
  userName: z.string(),
  userPhone: z.string(),
  providerName: z.string().nullable(),
});
export type BookingAdminListItem = z.infer<typeof BookingAdminListItemSchema>;

export const BookingAdminQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  status: BookingStatusSchema.optional(),
  category: BookingCategorySchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type BookingAdminQuery = z.infer<typeof BookingAdminQuerySchema>;

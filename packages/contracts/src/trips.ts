import { z } from 'zod';
import { PaymentStatusSchema, type PaymentStatus } from './payment.js';

export const TripStatusSchema = z.enum(['draft', 'published', 'archived']);
export type TripStatus = z.infer<typeof TripStatusSchema>;

export const ItineraryDaySchema = z.object({
  day: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  activities: z.array(z.string()),
  meals: z.array(z.string()).optional(),
});
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;

export const TripSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  destination: z.string(),
  durationDays: z.number().int().positive(),
  basePrice: z.number().int().nonnegative(),
  maxGroupSize: z.number().int().positive(),
  itinerary: z.array(ItineraryDaySchema),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  difficulty: z.enum(['easy', 'moderate', 'challenging']),
  imageIds: z.array(z.string().uuid()),
  status: TripStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Trip = z.infer<typeof TripSchema>;

export const CreateTripRequestSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(5000),
  destination: z.string().min(1).max(200),
  durationDays: z.number().int().positive(),
  basePrice: z.number().int().nonnegative(),
  maxGroupSize: z.number().int().positive(),
  itinerary: z.array(ItineraryDaySchema).min(1),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'moderate', 'challenging']),
  imageIds: z.array(z.string().uuid()).optional(),
  status: TripStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateTripRequest = z.infer<typeof CreateTripRequestSchema>;

export const UpdateTripRequestSchema = CreateTripRequestSchema.partial();
export type UpdateTripRequest = z.infer<typeof UpdateTripRequestSchema>;

export const TripListQuerySchema = z.object({
  destination: z.string().optional(),
  difficulty: z.enum(['easy', 'moderate', 'challenging']).optional(),
  status: TripStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type TripListQuery = z.infer<typeof TripListQuerySchema>;

export const TripWithImagesSchema = TripSchema.extend({
  images: z.array(
    z.object({
      id: z.string().uuid(),
      url: z.string().url(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
    })
  ),
});
export type TripWithImages = z.infer<typeof TripWithImagesSchema>;

export const TripBookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
]);
export type TripBookingStatus = z.infer<typeof TripBookingStatusSchema>;


export const TripBookingSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  bookingNumber: z.string(),
  startDate: z.string().datetime(),
  numberOfTravelers: z.number().int().positive(),
  totalPrice: z.number().int().nonnegative(),
  status: TripBookingStatusSchema,
  paymentStatus: PaymentStatusSchema,
  travelerDetails: z.array(
    z.object({
      name: z.string(),
      age: z.number().int().positive(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
  ),
  specialRequests: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type TripBooking = z.infer<typeof TripBookingSchema>;

export const TravelerDetailsSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive().max(120),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type TravelerDetails = z.infer<typeof TravelerDetailsSchema>;

export const CreateTripBookingRequestSchema = z.object({
  tripId: z.string().uuid(),
  startDate: z.string().datetime(),
  numberOfTravelers: z.number().int().positive(),
  travelerDetails: z.array(TravelerDetailsSchema).min(1),
  specialRequests: z.string().max(1000).optional(),
});
export type CreateTripBookingRequest = z.infer<typeof CreateTripBookingRequestSchema>;

export const UpdateTripBookingRequestSchema = z.object({
  status: TripBookingStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  specialRequests: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateTripBookingRequest = z.infer<typeof UpdateTripBookingRequestSchema>;

export const TripBookingListQuerySchema = z.object({
  status: TripBookingStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type TripBookingListQuery = z.infer<typeof TripBookingListQuerySchema>;

export const TripBookingWithTripSchema = TripBookingSchema.extend({
  tripName: z.string(),
  tripDestination: z.string(),
  tripDurationDays: z.number().int(),
});
export type TripBookingWithTrip = z.infer<typeof TripBookingWithTripSchema>;

export const TripBookingAdminListItemSchema = TripBookingSchema.extend({
  tripName: z.string(),
  userName: z.string(),
  userPhone: z.string(),
});
export type TripBookingAdminListItem = z.infer<typeof TripBookingAdminListItemSchema>;

export const TripBookingAdminQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  status: TripBookingStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type TripBookingAdminQuery = z.infer<typeof TripBookingAdminQuerySchema>;

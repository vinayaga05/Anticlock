import { z } from 'zod';
import { ProfileRelationshipSchema } from './profile-follows.js';
import { ServiceModeSchema } from './booking.js';

const publicWebsite = z.string().url().refine(value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Use an HTTP or HTTPS website without credentials.');

export const BusinessServiceSchema = z.object({
  id: z.string().uuid(), categoryId: z.string(), title: z.string(), description: z.string().nullable(),
  price: z.number().nonnegative().nullable(), durationMinutes: z.number().int().positive().nullable(),
  modes: z.array(ServiceModeSchema), available: z.boolean(),
});
export type BusinessService = z.infer<typeof BusinessServiceSchema>;
export const BusinessReviewSchema = z.object({
  id: z.string().uuid(), rating: z.number().int().min(1).max(5), body: z.string(),
  author: z.object({ id: z.string().uuid(), displayName: z.string(), avatarUrl: z.string().nullable() }),
  serviceTitle: z.string(), verifiedBooking: z.literal(true),
  photos: z.array(z.object({ id: z.string().uuid(), url: z.string() })), createdAt: z.string().datetime(),
});
export type BusinessReview = z.infer<typeof BusinessReviewSchema>;
export const BusinessProfileSchema = z.object({
  id: z.string().uuid(), name: z.string(), providerKind: z.string(), verified: z.boolean(),
  description: z.string().nullable(), avatarUrl: z.string().nullable(), coverUrl: z.string().nullable(),
  tagline: z.string().nullable(), brandAccentColor: z.string().nullable(), yearsInBusiness: z.number().nullable(), certifications: z.array(z.string()), languages: z.array(z.string()),
  categories: z.array(z.object({ id: z.string(), name: z.string(), treeId: z.string() })),
  gallery: z.array(z.object({ id: z.string().uuid(), url: z.string(), kind: z.enum(['image', 'video']) })),
  services: z.array(BusinessServiceSchema),
  contact: z.object({ phone: z.string().nullable(), email: z.string().nullable(), website: z.string().nullable() }),
  location: z.object({ address: z.string().nullable(), city: z.string().nullable(), area: z.string().nullable(), pincode: z.string().nullable(), latitude: z.number().nullable(), longitude: z.number().nullable(), serviceRadiusKm: z.number().nullable() }),
  availability: z.object({ timeZone: z.literal('Asia/Kolkata'), workingDays: z.array(z.string()), openingTime: z.string().nullable(), closingTime: z.string().nullable(), temporarilyUnavailable: z.boolean(), operatingStatus: z.enum(['open', 'closed', 'temporarily_unavailable', 'fully_booked', 'unknown']), nextAvailableAt: z.string().datetime().nullable() }),
  rating: z.object({ average: z.number().nullable(), count: z.number().int().nonnegative() }),
  reviews: z.array(BusinessReviewSchema),
  products: z.array(z.object({ id: z.string().uuid(), name: z.string(), price: z.number(), inventory: z.number(), imageUrl: z.string().nullable() })),
  events: z.array(z.object({ id: z.string().uuid(), title: z.string(), startsAt: z.string().datetime(), endsAt: z.string().datetime().nullable(), price: z.number(), currency: z.string(), imageUrl: z.string().nullable(), locationLabel: z.string().nullable() })),
  stats: z.object({ followers: z.number(), clips: z.number(), products: z.number(), events: z.number() }),
  viewer: z.object({ role: z.string().nullable(), isOwner: z.boolean(), canManage: z.boolean(), canPublish: z.boolean(), canEditServices: z.boolean(), canViewAnalytics: z.boolean(), isSaved: z.boolean(), canReview: z.boolean(), relationship: ProfileRelationshipSchema.nullable() }),
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export const SavedBusinessCardSchema = z.object({
  id: z.string().uuid(), name: z.string(), avatarUrl: z.string().nullable(), coverUrl: z.string().nullable(),
  categoryLabel: z.string().nullable(), city: z.string().nullable(), area: z.string().nullable(), savedAt: z.string().datetime(),
});
export type SavedBusinessCard = z.infer<typeof SavedBusinessCardSchema>;
export const SavedBusinessesResponseSchema = z.object({ businesses: z.array(SavedBusinessCardSchema), nextCursor: z.string().nullable() });
export type SavedBusinessesResponse = z.infer<typeof SavedBusinessesResponseSchema>;
export const BusinessAvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), categoryId: z.string().min(1),
  serviceMode: ServiceModeSchema, durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
});
export type BusinessAvailabilityQuery = z.infer<typeof BusinessAvailabilityQuerySchema>;
export const BusinessAvailabilitySchema = z.object({
  date: z.string(), categoryId: z.string(), serviceMode: ServiceModeSchema, durationMinutes: z.number(), timeZone: z.literal('Asia/Kolkata'),
  slots: z.array(z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime(), available: z.boolean() })),
  reason: z.string().nullable(),
});
export type BusinessAvailability = z.infer<typeof BusinessAvailabilitySchema>;
export const UpdateBusinessProfileRequestSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(), description: z.string().trim().min(10).max(2000).optional(),
  tagline: z.string().trim().max(160).nullable().optional(), brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(), yearsInBusiness: z.number().int().min(0).max(200).nullable().optional(), certifications: z.array(z.string().trim().min(1).max(120)).max(20).optional(), languages: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  phone: z.string().trim().min(8).max(20).nullable().optional(), email: z.string().email().nullable().optional(), website: publicWebsite.nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), area: z.string().trim().max(100).nullable().optional(), pincode: z.string().trim().max(12).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), serviceRadiusKm: z.number().positive().max(500).nullable().optional(),
  workingDays: z.array(z.string()).min(1).max(7).optional(), openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  temporarilyUnavailable: z.boolean().optional(), logoMediaId: z.string().uuid().nullable().optional(), coverMediaId: z.string().uuid().nullable().optional(), galleryMediaIds: z.array(z.string().uuid()).max(20).optional(),
}).strict();
export type UpdateBusinessProfileRequest = z.infer<typeof UpdateBusinessProfileRequestSchema>;
export const UpdateBusinessServicesRequestSchema = z.object({ services: z.array(z.object({
  categoryId: z.string().min(1), description: z.string().trim().max(1000).nullable(), price: z.number().int().nonnegative().max(2147483647).nullable(),
  durationMinutes: z.number().int().min(5).max(480).nullable(), modes: z.array(ServiceModeSchema).min(1), available: z.boolean(),
}).strict()).min(1).max(20) }).strict();
export type UpdateBusinessServicesRequest = z.infer<typeof UpdateBusinessServicesRequestSchema>;
export const CreateBusinessReviewRequestSchema = z.object({ bookingId: z.string().uuid(), rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(2000).refine(value => [...value].length >= 10, 'Write at least 10 characters.'), photoMediaIds: z.array(z.string().uuid()).max(4).default([]) }).strict();
export type CreateBusinessReviewRequest = z.infer<typeof CreateBusinessReviewRequestSchema>;
export const BusinessAnalyticsSchema = z.object({ totalBookings: z.number(), upcomingBookings: z.number(), completedBookings: z.number(), paidRevenue: z.number(), totalReviews: z.number(), averageRating: z.number().nullable(), profileViews: z.number().nullable() });
export type BusinessAnalytics = z.infer<typeof BusinessAnalyticsSchema>;

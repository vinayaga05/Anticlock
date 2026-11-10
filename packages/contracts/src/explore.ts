import { z } from 'zod';
import {
  ContentPublisherSchema,
  PublisherProfileTypeSchema,
} from './publishing.js';

export const ExploreReviewStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'changes_requested',
  'rejected',
  'suspended',
  'archived',
]);
export type ExploreReviewStatus = z.infer<typeof ExploreReviewStatusSchema>;

export const ExploreVisibilitySchema = z.enum([
  'followers_only',
  'public',
]);
export type ExploreVisibility = z.infer<typeof ExploreVisibilitySchema>;

export const ExploreReviewActionSchema = z.enum([
  'approve',
  'request_changes',
  'reject',
  'suspend',
  'restore',
  'archive',
]);
export type ExploreReviewAction = z.infer<typeof ExploreReviewActionSchema>;

export const ExploreMediaSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['image', 'video']),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
});
export type ExploreMedia = z.infer<typeof ExploreMediaSchema>;

export const EventVenueTypeSchema = z.enum(['physical', 'online', 'hybrid']);
export const EventTicketTypeSchema = z.enum([
  'free',
  'paid',
  'registration_required',
]);

export const ExploreEventLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().min(1).max(500),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude and longitude must be supplied together',
      });
    }
  });

export const ExploreContactSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(8).max(20).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add an email address or phone number',
      });
    }
  });

const EventFieldsSchema = z
  .object({
    publisherProfileId: z.string().uuid().optional(),
    publisherProfileType: PublisherProfileTypeSchema.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10_000),
    categoryId: z.string().trim().min(1).max(120),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(50)).max(15).default([]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string().trim().min(1).max(100),
    venueType: EventVenueTypeSchema,
    location: ExploreEventLocationSchema.nullable().optional(),
    onlineUrl: z.string().url().nullable().optional(),
    ticketType: EventTicketTypeSchema,
    capacity: z.number().int().positive().max(1_000_000),
    price: z.number().int().nonnegative().default(0),
    currency: z.string().length(3).default('INR'),
    contact: ExploreContactSchema,
    requestedVisibility: ExploreVisibilitySchema,
    mediaIds: z.array(z.string().uuid()).min(1).max(10),
    challengeId: z.string().uuid().nullable().optional(),
  })
  .strict();

function validateEventFields(
  value: z.infer<typeof EventFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  const startsAt = new Date(value.startsAt).getTime();
  const endsAt = new Date(value.endsAt).getTime();
  if (endsAt <= startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'End time must be after start time',
    });
  }
  if (value.ticketType === 'paid' && value.price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Paid events need a positive price',
    });
  }
  if (value.ticketType !== 'paid' && value.price !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Only paid events can have a price',
    });
  }
  if (value.venueType !== 'online' && !value.location) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['location'],
      message: 'Physical and hybrid events need a location',
    });
  }
  if (value.venueType !== 'physical' && !value.onlineUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['onlineUrl'],
      message: 'Online and hybrid events need an online link',
    });
  }
}

export const CreateExploreEventRequestSchema = EventFieldsSchema.superRefine(
  validateEventFields,
);
export type CreateExploreEventRequest = z.infer<
  typeof CreateExploreEventRequestSchema
>;

export const UpdateExploreEventRequestSchema = EventFieldsSchema.omit({
  publisherProfileId: true,
  publisherProfileType: true,
})
  .partial()
  .strict();
export type UpdateExploreEventRequest = z.infer<
  typeof UpdateExploreEventRequestSchema
>;

export const ExploreEventSchema = z.object({
  id: z.string().uuid(),
  ownerMobileUserId: z.string().uuid(),
  publisherProfileId: z.string().uuid(),
  publisherProfileType: PublisherProfileTypeSchema,
  publisher: ContentPublisherSchema,
  title: z.string(),
  description: z.string(),
  categoryId: z.string(),
  tags: z.array(z.string()),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string(),
  venueType: EventVenueTypeSchema,
  location: ExploreEventLocationSchema.nullable(),
  onlineUrl: z.string().url().nullable(),
  ticketType: EventTicketTypeSchema,
  capacity: z.number().int().positive(),
  registrationCount: z.number().int().nonnegative(),
  availableCapacity: z.number().int().nonnegative(),
  price: z.number().int().nonnegative(),
  currency: z.string(),
  contact: ExploreContactSchema,
  requestedVisibility: ExploreVisibilitySchema,
  reviewStatus: ExploreReviewStatusSchema,
  reviewReason: z.string().nullable(),
  reviewVersion: z.number().int().positive(),
  media: z.array(ExploreMediaSchema),
  viewerCanManage: z.boolean(),
  viewerIsRegistered: z.boolean(),
  viewerHasSaved: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  approvedAt: z.string().datetime().nullable(),
});
export type ExploreEvent = z.infer<typeof ExploreEventSchema>;

export const ExploreEventListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().max(120).optional(),
  following: z.coerce.boolean().optional(),
  startsAfter: z.string().datetime().optional(),
  startsBefore: z.string().datetime().optional(),
  freeOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().datetime().optional(),
  viewerProfileId: z.string().uuid().optional(),
  viewerProfileType: PublisherProfileTypeSchema.optional(),
});

export const ExploreEventListResponseSchema = z.object({
  events: z.array(ExploreEventSchema),
  nextCursor: z.string().datetime().nullable(),
});
export type ExploreEventListResponse = z.infer<
  typeof ExploreEventListResponseSchema
>;

export const ExploreReviewRequestSchema = z
  .object({
    action: ExploreReviewActionSchema,
    reason: z.string().trim().max(2_000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      ['request_changes', 'reject', 'suspend'].includes(value.action) &&
      !value.reason
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A reason is required for this action',
      });
    }
  });
export type ExploreReviewRequest = z.infer<typeof ExploreReviewRequestSchema>;

export const ExploreAdminListQuerySchema = z.object({
  status: ExploreReviewStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().datetime().optional(),
});

export const ExploreRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  status: z.enum(['registered', 'cancelled']),
  createdAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
});
export type ExploreRegistration = z.infer<typeof ExploreRegistrationSchema>;

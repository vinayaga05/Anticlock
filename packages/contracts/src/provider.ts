import { z } from 'zod';

export const ProviderKindSchema = z.enum(['business', 'individual']);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'more_info_requested',
]);
export type ProviderApplicationStatus = z.infer<
  typeof ProviderApplicationStatusSchema
>;

export const FormFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'phone',
  'email',
  'dropdown',
  'multiselect',
  'date',
  'time',
  'image',
  'video',
  'document',
  'location',
  'boolean',
  'currency',
  'aadhaar',
]);
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;

export const FormFieldValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  pattern: z.string().optional(),
});
export type FormFieldValidation = z.infer<typeof FormFieldValidationSchema>;

export const FormFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;

export const FormFieldVisibleWhenSchema = z.object({
  providerKind: ProviderKindSchema.optional(),
});
export type FormFieldVisibleWhen = z.infer<typeof FormFieldVisibleWhenSchema>;

export const FormSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});
export type FormSection = z.infer<typeof FormSectionSchema>;

export const FormFieldDefinitionSchema = z.object({
  key: z.string(),
  type: FormFieldTypeSchema,
  label: z.string(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  sectionId: z.string(),
  options: z.array(FormFieldOptionSchema).optional(),
  validation: FormFieldValidationSchema.optional(),
  visibleWhen: FormFieldVisibleWhenSchema.optional(),
});
export type FormFieldDefinition = z.infer<typeof FormFieldDefinitionSchema>;

export const ProviderFormSchemaScopeSchema = z.enum(['global', 'category']);
export type ProviderFormSchemaScope = z.infer<
  typeof ProviderFormSchemaScopeSchema
>;

export const ProviderFormSchemaStatusSchema = z.enum(['draft', 'published']);
export type ProviderFormSchemaStatus = z.infer<
  typeof ProviderFormSchemaStatusSchema
>;

export const ProviderFormSchemaBodySchema = z.object({
  scope: ProviderFormSchemaScopeSchema,
  categoryId: z.string().optional(),
  providerKinds: z.array(ProviderKindSchema).min(1),
  version: z.number().int().positive().default(1),
  status: ProviderFormSchemaStatusSchema.default('published'),
  sections: z.array(FormSectionSchema),
  fields: z.array(FormFieldDefinitionSchema),
});
export type ProviderFormSchemaBody = z.infer<
  typeof ProviderFormSchemaBodySchema
>;

export const ProviderFormSchemaSchema = ProviderFormSchemaBodySchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProviderFormSchema = z.infer<typeof ProviderFormSchemaSchema>;

export const ResolvedProviderFormSchemaSchema = z.object({
  sections: z.array(FormSectionSchema),
  fields: z.array(FormFieldDefinitionSchema),
  categoryIds: z.array(z.string()),
});
export type ResolvedProviderFormSchema = z.infer<
  typeof ResolvedProviderFormSchemaSchema
>;

/**
 * Mobile forms hold numbers as text while the user types. Accept a numeric
 * string (commas/whitespace allowed) and coerce it to a number; an empty
 * string means "not provided". Anything else must already be a number.
 */
export function numberish<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(value => {
    if (typeof value !== 'string') return value;
    const trimmed = value.replace(/[,\s]/g, '');
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }, schema);
}

const optionalNumber = (schema: z.ZodNumber) => numberish(schema.optional());

export const ProviderLocationSchema = z.object({
  address: z.string().min(1),
  area: z.string().optional(),
  city: z.string().min(1),
  pincode: z.string().min(4),
  latitude: optionalNumber(z.number().min(-90).max(90)),
  longitude: optionalNumber(z.number().min(-180).max(180)),
  serviceRadiusKm: optionalNumber(z.number().positive()),
});
export type ProviderLocation = z.infer<typeof ProviderLocationSchema>;

export const ProviderAvailabilitySchema = z.object({
  workingDays: z.array(z.string()).min(1),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  appointmentAvailable: z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
});
export type ProviderAvailability = z.infer<typeof ProviderAvailabilitySchema>;

export const ProviderServicesSummarySchema = z.object({
  pricingStartsAt: optionalNumber(z.number().nonnegative()),
  serviceArea: z.string().optional(),
  atLocation: z.boolean().optional(),
  homeVisit: z.boolean().optional(),
  online: z.boolean().optional(),
});
export type ProviderServicesSummary = z.infer<
  typeof ProviderServicesSummarySchema
>;

export const ProviderProfileSchema = z.object({
  logoMediaId: z.string().uuid().optional(),
  coverMediaIds: z.array(z.string().uuid()).max(10).optional(),
  introVideoMediaId: z.string().uuid().optional(),
  description: z.string().optional(),
  yearsInOperation: optionalNumber(z.number().int().nonnegative()),
});
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

export const ProviderApplicationCommonPayloadSchema = z.object({
  basic: z.object({
    providerName: z.string().min(1),
    contactPerson: z.string().min(1),
    mobile: z.string().min(8),
    email: z.string().email(),
  }),
  location: ProviderLocationSchema,
  profile: ProviderProfileSchema,
  availability: ProviderAvailabilitySchema,
  services: ProviderServicesSummarySchema,
});
export type ProviderApplicationCommonPayload = z.infer<
  typeof ProviderApplicationCommonPayloadSchema
>;

/**
 * A draft is saved while it is still incomplete (autosave), so every field
 * inside every section is optional. Types are still enforced, and numeric
 * strings are coerced to numbers. Completeness is checked at submit.
 */
export const ProviderApplicationDraftCommonPayloadSchema = z.object({
  basic: z
    .object({
      providerName: z.string(),
      contactPerson: z.string(),
      mobile: z.string(),
      email: z.string(),
    })
    .partial()
    .optional(),
  location: ProviderLocationSchema.extend({
    address: z.string(),
    city: z.string(),
    pincode: z.string(),
  })
    .partial()
    .optional(),
  profile: ProviderProfileSchema.partial().optional(),
  availability: ProviderAvailabilitySchema.extend({
    workingDays: z.array(z.string()),
  })
    .partial()
    .optional(),
  services: ProviderServicesSummarySchema.partial().optional(),
});
export type ProviderApplicationDraftCommonPayload = z.infer<
  typeof ProviderApplicationDraftCommonPayloadSchema
>;

/**
 * Form-schema keys whose values live under a different contract key. Image
 * and video profile fields upload as public profile media and store media
 * ids (not application documents).
 */
export const PROVIDER_FORM_FIELD_ALIASES: Record<string, string> = {
  'profile.logo': 'profile.logoMediaId',
  'profile.coverImages': 'profile.coverMediaIds',
  'profile.introVideo': 'profile.introVideoMediaId',
};

export const CreateProviderApplicationRequestSchema = z.object({
  providerKind: ProviderKindSchema,
});
export type CreateProviderApplicationRequest = z.infer<
  typeof CreateProviderApplicationRequestSchema
>;

export const UpdateProviderApplicationRequestSchema = z.object({
  providerKind: ProviderKindSchema.optional(),
  commonPayload: ProviderApplicationDraftCommonPayloadSchema.optional(),
  dynamicPayload: z.record(z.unknown()).optional(),
  aadhaarNumber: z.string().optional(),
});
export type UpdateProviderApplicationRequest = z.infer<
  typeof UpdateProviderApplicationRequestSchema
>;

export const SetProviderApplicationServicesRequestSchema = z.object({
  categoryIds: z.array(z.string()).length(1),
});
export type SetProviderApplicationServicesRequest = z.infer<
  typeof SetProviderApplicationServicesRequestSchema
>;

export const ProviderApplicationDocumentSchema = z.object({
  fieldKey: z.string(),
  mediaId: z.string().uuid(),
  label: z.string().optional(),
  uploadedAt: z.string().datetime(),
});
export type ProviderApplicationDocument = z.infer<
  typeof ProviderApplicationDocumentSchema
>;

export const ProviderCategoryLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  treeId: z.string().optional(),
});
export type ProviderCategoryLabel = z.infer<typeof ProviderCategoryLabelSchema>;

export const ProviderApplicationSummarySchema = z.object({
  id: z.string().uuid(),
  businessName: z.string(),
  providerKind: ProviderKindSchema,
  status: ProviderApplicationStatusSchema,
  categoryIds: z.array(z.string()),
  categories: z.array(ProviderCategoryLabelSchema).optional(),
  submittedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  infoRequestMessage: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  providerId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProviderApplicationSummary = z.infer<
  typeof ProviderApplicationSummarySchema
>;

export const ProviderApplicationMissingItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  sectionId: z.string(),
  reason: z.enum(['required', 'invalid', 'document', 'services']),
  message: z.string(),
});
export type ProviderApplicationMissingItem = z.infer<
  typeof ProviderApplicationMissingItemSchema
>;

/** Server-computed completeness: the same check that gates submit/approve. */
export const ProviderApplicationReadinessSchema = z.object({
  complete: z.boolean(),
  requiredCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  missing: z.array(ProviderApplicationMissingItemSchema),
});
export type ProviderApplicationReadiness = z.infer<
  typeof ProviderApplicationReadinessSchema
>;

export const ProviderMediaPreviewSchema = z.object({
  mediaId: z.string().uuid(),
  kind: z.enum(['image', 'video', 'document']),
  filename: z.string().nullable(),
  /** Public URL for profile media; null for private KYC documents. */
  url: z.string().url().nullable(),
});
export type ProviderMediaPreview = z.infer<typeof ProviderMediaPreviewSchema>;

export const ProviderApplicationDetailSchema =
  ProviderApplicationSummarySchema.extend({
    commonPayload: ProviderApplicationDraftCommonPayloadSchema,
    dynamicPayload: z.record(z.unknown()),
    documents: z.array(ProviderApplicationDocumentSchema),
    aadhaarMasked: z.string().nullable().optional(),
    readiness: ProviderApplicationReadinessSchema.optional(),
    mediaPreviews: z.array(ProviderMediaPreviewSchema).optional(),
  });
export type ProviderApplicationDetail = z.infer<
  typeof ProviderApplicationDetailSchema
>;

export const ProviderApplicationAdminDetailSchema =
  ProviderApplicationDetailSchema.extend({
    allowedActions: z.array(z.lazy(() => ProviderApplicationReviewActionSchema)),
    applicantName: z.string(),
    applicantPhone: z.string(),
    documents: z.array(
      ProviderApplicationDocumentSchema.extend({
        downloadUrl: z.string().url().nullable().optional(),
      }),
    ),
    aadhaarMasked: z.string().nullable(),
  });
export type ProviderApplicationAdminDetail = z.infer<
  typeof ProviderApplicationAdminDetailSchema
>;

export const ProviderApplicationReviewActionSchema = z.enum([
  'approve',
  'reject',
  'request_info',
  'mark_under_review',
]);
export type ProviderApplicationReviewAction = z.infer<
  typeof ProviderApplicationReviewActionSchema
>;

/**
 * The only valid admin review transitions. Anything else is a 409.
 *   submitted     -> under_review | more_info_requested | rejected
 *   under_review  -> approved | more_info_requested | rejected
 * Applicant transitions (not admin actions):
 *   draft | more_info_requested -> submitted (submit, when complete)
 *   rejected -> draft (reopen to fix and resubmit)
 */
export const PROVIDER_REVIEW_TRANSITIONS: Record<
  ProviderApplicationStatus,
  ProviderApplicationReviewAction[]
> = {
  draft: [],
  submitted: ['mark_under_review', 'request_info', 'reject'],
  under_review: ['approve', 'request_info', 'reject'],
  more_info_requested: [],
  approved: [],
  rejected: [],
};

export function allowedReviewActions(
  status: string,
): ProviderApplicationReviewAction[] {
  return (
    PROVIDER_REVIEW_TRANSITIONS[status as ProviderApplicationStatus] ?? []
  );
}

export const PROVIDER_APPLICANT_SUBMITTABLE_STATUSES: ProviderApplicationStatus[] =
  ['draft', 'more_info_requested'];

export const ProviderApplicationReviewRequestSchema = z.object({
  action: ProviderApplicationReviewActionSchema,
  notes: z.string().max(2000).optional(),
  infoRequestMessage: z.string().max(2000).optional(),
});
export type ProviderApplicationReviewRequest = z.infer<
  typeof ProviderApplicationReviewRequestSchema
>;

export const ResolveFormSchemaQuerySchema = z.object({
  providerKind: ProviderKindSchema,
  categoryIds: z.union([z.string(), z.array(z.string())]),
});
export type ResolveFormSchemaQuery = z.infer<
  typeof ResolveFormSchemaQuerySchema
>;

/** Upload size limits mirrored from the API's media validation. */
export const PROVIDER_UPLOAD_LIMITS = {
  image: { maxBytes: 10 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  document: {
    maxBytes: 20 * 1024 * 1024,
    mimes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  video: { maxBytes: 250 * 1024 * 1024, mimes: ['video/mp4'] },
} as const;

export const ProviderKycUploadRequestSchema = z.object({
  fieldKey: z.string().min(1).max(120),
  /**
   * `document` = private KYC document attached to the application.
   * `profile`  = public profile image/video whose media id is stored in the
   *              application payload (e.g. profile.logoMediaId).
   */
  purpose: z.enum(['document', 'profile']).default('document'),
  kind: z.enum(['image', 'document', 'video']),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().positive(),
});
export type ProviderKycUploadRequest = z.infer<
  typeof ProviderKycUploadRequestSchema
>;

// ---------------------------------------------------------------------------
// Approved businesses (marketplace + owner dashboard)
// ---------------------------------------------------------------------------

export const ServiceModeFlagsSchema = z.array(z.enum(['center', 'home', 'online']));

export const MarketplaceProviderCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  providerKind: ProviderKindSchema,
  categoryIds: z.array(z.string()),
  categories: z.array(
    ProviderCategoryLabelSchema.extend({ actionType: z.string().nullable() }),
  ),
  city: z.string().nullable(),
  area: z.string().nullable(),
  description: z.string().nullable(),
  priceFrom: z.number().nullable(),
  avatarUrl: z.string().url().nullable(),
  coverUrl: z.string().url().nullable(),
  modes: ServiceModeFlagsSchema,
  workingDays: z.array(z.string()),
  openingTime: z.string().nullable(),
  closingTime: z.string().nullable(),
  verified: z.boolean(),
  createdAt: z.string().datetime(),
});
export type MarketplaceProviderCard = z.infer<typeof MarketplaceProviderCardSchema>;

export const MarketplaceProviderListQuerySchema = z.object({
  q: z.string().max(100).optional(),
  categoryId: z.string().max(120).optional(),
  treeId: z.string().max(60).optional(),
  city: z.string().max(80).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().nonnegative().max(1000).optional(),
});
export type MarketplaceProviderListQuery = z.infer<
  typeof MarketplaceProviderListQuerySchema
>;

export const ProviderBusinessServiceSchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  pricingStartsAt: z.number().nullable(),
});

export const ProviderBusinessSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  providerKind: ProviderKindSchema,
  status: z.string(),
  role: z.string(),
  applicationId: z.string().uuid().nullable(),
  avatarUrl: z.string().url().nullable(),
  categories: z.array(ProviderCategoryLabelSchema),
  counts: z.object({
    services: z.number().int().nonnegative(),
    upcomingBookings: z.number().int().nonnegative(),
    totalBookings: z.number().int().nonnegative(),
  }),
  createdAt: z.string().datetime(),
});
export type ProviderBusinessSummary = z.infer<
  typeof ProviderBusinessSummarySchema
>;

export const ProviderBusinessBookingSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  serviceTitle: z.string(),
  customerName: z.string(),
  startsAt: z.string().datetime(),
  serviceMode: z.string(),
  amount: z.number().nullable(),
});

export const ProviderBusinessDetailSchema = ProviderBusinessSummarySchema.extend({
  profile: z.object({
    description: z.string().nullable(),
    contactPerson: z.string().nullable(),
    mobile: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    area: z.string().nullable(),
    pricingStartsAt: z.number().nullable(),
    workingDays: z.array(z.string()),
    openingTime: z.string().nullable(),
    closingTime: z.string().nullable(),
    modes: ServiceModeFlagsSchema,
  }),
  services: z.array(ProviderBusinessServiceSchema),
  upcomingBookings: z.array(ProviderBusinessBookingSchema),
});
export type ProviderBusinessDetail = z.infer<typeof ProviderBusinessDetailSchema>;

export const UpdateProviderBusinessRequestSchema = z
  .object({
    description: z.string().max(2000).optional(),
    contactPerson: z.string().min(1).max(120).optional(),
    mobile: z.string().min(8).max(20).optional(),
    email: z.string().email().optional(),
    pricingStartsAt: numberish(z.number().nonnegative().optional()),
    openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .strict();
export type UpdateProviderBusinessRequest = z.infer<
  typeof UpdateProviderBusinessRequestSchema
>;

export const MobileRoleSchema = z.enum(['service_provider']);
export type MobileRole = z.infer<typeof MobileRoleSchema>;

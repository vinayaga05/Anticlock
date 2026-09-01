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

export const ProviderLocationSchema = z.object({
  address: z.string().min(1),
  area: z.string().optional(),
  city: z.string().min(1),
  pincode: z.string().min(4),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  serviceRadiusKm: z.number().positive().optional(),
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
  pricingStartsAt: z.number().nonnegative().optional(),
  serviceArea: z.string().optional(),
  atLocation: z.boolean().optional(),
  homeVisit: z.boolean().optional(),
  online: z.boolean().optional(),
});
export type ProviderServicesSummary = z.infer<
  typeof ProviderServicesSummarySchema
>;

export const ProviderApplicationCommonPayloadSchema = z.object({
  basic: z.object({
    providerName: z.string().min(1),
    contactPerson: z.string().min(1),
    mobile: z.string().min(8),
    email: z.string().email(),
  }),
  location: ProviderLocationSchema,
  profile: z.object({
    logoMediaId: z.string().uuid().optional(),
    coverMediaIds: z.array(z.string().uuid()).optional(),
    introVideoMediaId: z.string().uuid().optional(),
    description: z.string().optional(),
    yearsInOperation: z.number().int().nonnegative().optional(),
  }),
  availability: ProviderAvailabilitySchema,
  services: ProviderServicesSummarySchema,
});
export type ProviderApplicationCommonPayload = z.infer<
  typeof ProviderApplicationCommonPayloadSchema
>;

export const CreateProviderApplicationRequestSchema = z.object({
  providerKind: ProviderKindSchema,
});
export type CreateProviderApplicationRequest = z.infer<
  typeof CreateProviderApplicationRequestSchema
>;

export const UpdateProviderApplicationRequestSchema = z.object({
  providerKind: ProviderKindSchema.optional(),
  commonPayload: ProviderApplicationCommonPayloadSchema.partial().optional(),
  dynamicPayload: z.record(z.unknown()).optional(),
  aadhaarNumber: z.string().optional(),
});
export type UpdateProviderApplicationRequest = z.infer<
  typeof UpdateProviderApplicationRequestSchema
>;

export const SetProviderApplicationServicesRequestSchema = z.object({
  categoryIds: z.array(z.string()).min(1).max(20),
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

export const ProviderApplicationSummarySchema = z.object({
  id: z.string().uuid(),
  providerKind: ProviderKindSchema,
  status: ProviderApplicationStatusSchema,
  categoryIds: z.array(z.string()),
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

export const ProviderApplicationDetailSchema =
  ProviderApplicationSummarySchema.extend({
    commonPayload: ProviderApplicationCommonPayloadSchema.partial(),
    dynamicPayload: z.record(z.unknown()),
    documents: z.array(ProviderApplicationDocumentSchema),
    aadhaarMasked: z.string().nullable().optional(),
  });
export type ProviderApplicationDetail = z.infer<
  typeof ProviderApplicationDetailSchema
>;

export const ProviderApplicationAdminDetailSchema =
  ProviderApplicationDetailSchema.extend({
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

export const ProviderKycUploadRequestSchema = z.object({
  fieldKey: z.string(),
  kind: z.enum(['image', 'document', 'video']),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().positive(),
});
export type ProviderKycUploadRequest = z.infer<
  typeof ProviderKycUploadRequestSchema
>;

export const MobileRoleSchema = z.enum(['service_provider']);
export type MobileRole = z.infer<typeof MobileRoleSchema>;

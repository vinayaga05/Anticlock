export type ProviderKind = 'business' | 'individual';

export type ProviderApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'more_info_requested';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'phone'
  | 'email'
  | 'dropdown'
  | 'multiselect'
  | 'date'
  | 'time'
  | 'image'
  | 'video'
  | 'document'
  | 'location'
  | 'boolean'
  | 'currency'
  | 'aadhaar';

export type FormFieldDefinition = {
  key: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required?: boolean;
  sectionId: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  sortOrder: number;
};

export type ResolvedProviderFormSchema = {
  sections: FormSection[];
  fields: FormFieldDefinition[];
  categoryIds: string[];
};

export type ProviderApplicationDocument = {
  fieldKey: string;
  mediaId: string;
  label?: string;
  uploadedAt: string;
};

export type ProviderCategoryLabel = { id: string; name: string; treeId?: string };

export type ProviderApplicationMissingItem = {
  key: string;
  label: string;
  sectionId: string;
  reason: 'required' | 'invalid' | 'document' | 'services';
  message: string;
};

export type ProviderApplicationReadiness = {
  complete: boolean;
  requiredCount: number;
  completedCount: number;
  missing: ProviderApplicationMissingItem[];
};

export type ProviderMediaPreview = {
  mediaId: string;
  kind: 'image' | 'video' | 'document';
  filename: string | null;
  url: string | null;
};

export type ProviderApplicationDetail = {
  id: string;
  businessName: string;
  providerKind: ProviderKind;
  status: ProviderApplicationStatus;
  categoryIds: string[];
  categories?: ProviderCategoryLabel[];
  submittedAt: string | null;
  reviewedAt: string | null;
  infoRequestMessage: string | null;
  reviewNotes: string | null;
  providerId: string | null;
  createdAt: string;
  updatedAt: string;
  commonPayload: Record<string, unknown>;
  dynamicPayload: Record<string, unknown>;
  documents: ProviderApplicationDocument[];
  aadhaarMasked?: string | null;
  readiness?: ProviderApplicationReadiness;
  mediaPreviews?: ProviderMediaPreview[];
};

export type ProviderApplicationSummary = Omit<
  ProviderApplicationDetail,
  | 'commonPayload'
  | 'dynamicPayload'
  | 'documents'
  | 'aadhaarMasked'
  | 'readiness'
  | 'mediaPreviews'
>;

export type ServiceModeFlag = 'center' | 'home' | 'online';

/** Approved business card from GET /v1/marketplace/providers. */
export type MarketplaceProviderCard = {
  id: string;
  name: string;
  providerKind: ProviderKind;
  categoryIds: string[];
  categories: Array<ProviderCategoryLabel & { actionType: string | null }>;
  city: string | null;
  area: string | null;
  description: string | null;
  priceFrom: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  modes: ServiceModeFlag[];
  workingDays: string[];
  openingTime: string | null;
  closingTime: string | null;
  verified: boolean;
  createdAt: string;
};

export type ProviderBusinessSummary = {
  id: string;
  name: string;
  providerKind: ProviderKind;
  status: string;
  role: string;
  applicationId: string | null;
  avatarUrl: string | null;
  categories: ProviderCategoryLabel[];
  counts: { services: number; upcomingBookings: number; totalBookings: number };
  createdAt: string;
};

export type ProviderBusinessDetail = ProviderBusinessSummary & {
  profile: {
    description: string | null;
    contactPerson: string | null;
    mobile: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    area: string | null;
    pricingStartsAt: number | null;
    workingDays: string[];
    openingTime: string | null;
    closingTime: string | null;
    modes: ServiceModeFlag[];
  };
  services: { categoryId: string; name: string; pricingStartsAt: number | null }[];
  upcomingBookings: {
    id: string;
    status: string;
    serviceTitle: string;
    customerName: string;
    startsAt: string;
    serviceMode: string;
    amount: number | null;
  }[];
};

export type UpdateProviderBusinessRequest = {
  description?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  pricingStartsAt?: number;
  openingTime?: string;
  closingTime?: string;
};

export type CreateProviderApplicationRequest = {
  providerKind: ProviderKind;
};

export type UpdateProviderApplicationRequest = {
  providerKind?: ProviderKind;
  commonPayload?: Record<string, unknown>;
  dynamicPayload?: Record<string, unknown>;
  aadhaarNumber?: string;
};

export type SetProviderApplicationServicesRequest = {
  categoryIds: string[];
};

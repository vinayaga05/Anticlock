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

export type ProviderApplicationDetail = {
  id: string;
  providerKind: ProviderKind;
  status: ProviderApplicationStatus;
  categoryIds: string[];
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

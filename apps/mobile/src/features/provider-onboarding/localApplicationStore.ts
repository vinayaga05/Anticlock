import { storage } from '@/shared/services/storage';
import { STORAGE_KEYS } from '@/shared/constants';
import type {
  ProviderApplicationDetail,
  ProviderKind,
  UpdateProviderApplicationRequest,
} from './types';

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `local-${Date.now()}`;
}

function maskAadhaar(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export function getLocalApplications(): ProviderApplicationDetail[] {
  const raw = storage.getString(STORAGE_KEYS.PROVIDER_APPLICATIONS)
    ?? storage.getString(STORAGE_KEYS.PROVIDER_APPLICATION);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ProviderApplicationDetail | ProviderApplicationDetail[];
    return (Array.isArray(parsed) ? parsed : [parsed]).map(application => ({
      ...application,
      businessName:
        application.businessName
        ?? (application.providerKind === 'business'
          ? 'New business'
          : 'New professional profile'),
    }));
  } catch {
    return [];
  }
}

export function getLocalApplication(applicationId?: string): ProviderApplicationDetail | null {
  const applications = getLocalApplications();
  if (applicationId) return applications.find(app => app.id === applicationId) ?? null;
  return applications.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function saveLocalApplication(app: ProviderApplicationDetail) {
  const applications = getLocalApplications();
  const index = applications.findIndex(existing => existing.id === app.id);
  if (index >= 0) applications[index] = app;
  else applications.unshift(app);
  storage.set(STORAGE_KEYS.PROVIDER_APPLICATIONS, JSON.stringify(applications));
  return app;
}

export function deleteLocalApplication(applicationId: string) {
  const applications = getLocalApplications();
  const exists = applications.some(application => application.id === applicationId);
  if (!exists) {
    throw new Error('Business not found');
  }
  storage.set(
    STORAGE_KEYS.PROVIDER_APPLICATIONS,
    JSON.stringify(applications.filter(application => application.id !== applicationId)),
  );
}

export function createLocalApplication(providerKind: ProviderKind) {
  const applications = getLocalApplications().filter(
    application => application.status !== 'draft',
  );
  storage.set(STORAGE_KEYS.PROVIDER_APPLICATIONS, JSON.stringify(applications));

  const createdAt = nowIso();
  return saveLocalApplication({
    id: newId(),
    businessName: providerKind === 'business' ? 'New business' : 'New professional profile',
    providerKind,
    status: 'draft',
    categoryIds: [],
    submittedAt: null,
    reviewedAt: null,
    infoRequestMessage: null,
    reviewNotes: null,
    providerId: null,
    createdAt,
    updatedAt: createdAt,
    commonPayload: {},
    dynamicPayload: {},
    documents: [],
  });
}

export function updateLocalApplication(
  applicationId: string,
  body: UpdateProviderApplicationRequest,
) {
  const existing = getLocalApplication(applicationId);
  if (!existing) {
    throw new Error('Application not found');
  }
  const next: ProviderApplicationDetail = {
    ...existing,
    providerKind: body.providerKind ?? existing.providerKind,
    commonPayload: body.commonPayload
      ? { ...existing.commonPayload, ...body.commonPayload }
      : existing.commonPayload,
    dynamicPayload: body.dynamicPayload
      ? { ...existing.dynamicPayload, ...body.dynamicPayload }
      : existing.dynamicPayload,
    updatedAt: nowIso(),
    businessName:
      typeof body.commonPayload?.basic === 'object' &&
      body.commonPayload.basic &&
      typeof (body.commonPayload.basic as Record<string, unknown>).providerName === 'string'
        ? (body.commonPayload.basic as Record<string, string>).providerName
        : existing.businessName,
    status: existing.status === 'more_info_requested' ? 'draft' : existing.status,
  };
  if (body.aadhaarNumber) {
    next.aadhaarMasked = maskAadhaar(body.aadhaarNumber);
  }
  return saveLocalApplication(next);
}

export function setLocalServices(applicationId: string, categoryIds: string[]) {
  const existing = getLocalApplication(applicationId);
  if (!existing) {
    throw new Error('Application not found');
  }
  return saveLocalApplication({
    ...existing,
    categoryIds: categoryIds.slice(0, 1),
    updatedAt: nowIso(),
  });
}

export function addLocalDocument(applicationId: string, fieldKey: string) {
  const existing = getLocalApplication(applicationId);
  if (!existing) {
    throw new Error('Application not found');
  }
  const documents = existing.documents.filter(d => d.fieldKey !== fieldKey);
  documents.push({
    fieldKey,
    mediaId: `local-doc-${fieldKey}`,
    uploadedAt: nowIso(),
  });
  return saveLocalApplication({
    ...existing,
    documents,
    updatedAt: nowIso(),
  });
}

export function submitLocalApplication(applicationId: string) {
  const existing = getLocalApplication(applicationId);
  if (!existing) {
    throw new Error('Application not found');
  }
  return saveLocalApplication({
    ...existing,
    status: 'submitted',
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

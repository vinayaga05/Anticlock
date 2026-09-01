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

export function getLocalApplication(): ProviderApplicationDetail | null {
  const raw = storage.getString(STORAGE_KEYS.PROVIDER_APPLICATION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProviderApplicationDetail;
  } catch {
    return null;
  }
}

export function saveLocalApplication(app: ProviderApplicationDetail) {
  storage.set(STORAGE_KEYS.PROVIDER_APPLICATION, JSON.stringify(app));
  return app;
}

export function createLocalApplication(providerKind: ProviderKind) {
  const existing = getLocalApplication();
  if (existing && existing.status !== 'rejected') {
    return saveLocalApplication({ ...existing, providerKind, updatedAt: nowIso() });
  }
  const createdAt = nowIso();
  return saveLocalApplication({
    id: newId(),
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
  const existing = getLocalApplication();
  if (!existing || existing.id !== applicationId) {
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
    status: existing.status === 'more_info_requested' ? 'draft' : existing.status,
  };
  if (body.aadhaarNumber) {
    next.aadhaarMasked = maskAadhaar(body.aadhaarNumber);
  }
  return saveLocalApplication(next);
}

export function setLocalServices(applicationId: string, categoryIds: string[]) {
  const existing = getLocalApplication();
  if (!existing || existing.id !== applicationId) {
    throw new Error('Application not found');
  }
  return saveLocalApplication({
    ...existing,
    categoryIds,
    updatedAt: nowIso(),
  });
}

export function addLocalDocument(applicationId: string, fieldKey: string) {
  const existing = getLocalApplication();
  if (!existing || existing.id !== applicationId) {
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
  const existing = getLocalApplication();
  if (!existing || existing.id !== applicationId) {
    throw new Error('Application not found');
  }
  return saveLocalApplication({
    ...existing,
    status: 'submitted',
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

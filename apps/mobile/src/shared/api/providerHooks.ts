import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProviderApplicationRequest,
  ProviderApplicationDetail,
  ProviderKind,
  ResolvedProviderFormSchema,
  SetProviderApplicationServicesRequest,
  UpdateProviderApplicationRequest,
} from '@/features/provider-onboarding/types';
import {
  addLocalDocument,
  createLocalApplication,
  getLocalApplication,
  setLocalServices,
  submitLocalApplication,
  updateLocalApplication,
} from '@/features/provider-onboarding/localApplicationStore';
import { resolveLocalFormSchema } from '@/features/provider-onboarding/localFormSchemas';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';

function ensureAuthToken() {
  const session = readStoredSession();
  if (!session?.token) {
    throw new Error('Not authenticated');
  }
}

export function useMyProviderApplicationQuery() {
  return useQuery({
    queryKey: ['provider', 'application', 'me', isApiEnabled ? 'api' : 'local'],
    queryFn: async () => {
      if (!isApiEnabled) return getLocalApplication();
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail | null }>(
        '/v1/provider/applications/me',
      );
      return res.application;
    },
  });
}

export function useResolvedFormSchemaQuery(
  providerKind: ProviderKind | undefined,
  categoryIds: string[],
) {
  return useQuery({
    queryKey: [
      'provider',
      'form-schema',
      providerKind,
      categoryIds.join(','),
      isApiEnabled ? 'api' : 'local',
    ],
    queryFn: async () => {
      if (!providerKind || !categoryIds.length) return null;
      if (!isApiEnabled) {
        return resolveLocalFormSchema(providerKind, categoryIds);
      }
      ensureAuthToken();
      const qs = new URLSearchParams({
        providerKind,
        categoryIds: categoryIds.join(','),
      });
      const res = await apiRequest<{ schema: ResolvedProviderFormSchema }>(
        `/v1/provider/form-schemas/resolve?${qs.toString()}`,
      );
      return res.schema;
    },
    enabled: Boolean(providerKind && categoryIds.length),
  });
}

export function useCreateProviderApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProviderApplicationRequest) => {
      if (!isApiEnabled) return createLocalApplication(body.providerKind);
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail }>(
        '/v1/provider/applications',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.application;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider', 'application'] });
    },
  });
}

export function useUpdateProviderApplicationMutation(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProviderApplicationRequest) => {
      if (!isApiEnabled) return updateLocalApplication(applicationId, body);
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail }>(
        `/v1/provider/applications/${applicationId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      return res.application;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider', 'application'] });
    },
  });
}

export function useSetProviderServicesMutation(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SetProviderApplicationServicesRequest) => {
      if (!isApiEnabled) return setLocalServices(applicationId, body.categoryIds);
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail }>(
        `/v1/provider/applications/${applicationId}/services`,
        { method: 'PUT', body: JSON.stringify(body) },
      );
      return res.application;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider', 'application'] });
    },
  });
}

export function useSubmitProviderApplicationMutation(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) return submitLocalApplication(applicationId);
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail }>(
        `/v1/provider/applications/${applicationId}/submit`,
        { method: 'POST' },
      );
      return res.application;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider', 'application'] });
    },
  });
}

export async function createProviderKycUploadSession(
  applicationId: string,
  body: {
    fieldKey: string;
    kind: 'image' | 'document' | 'video';
    filename: string;
    contentType: string;
    byteSize: number;
  },
) {
  ensureAuthToken();
  return apiRequest<{
    sessionId: string;
    mediaId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  }>(`/v1/provider/applications/${applicationId}/kyc-upload-session`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadProviderDocument(
  applicationId: string,
  fieldKey: string,
  filename: string,
  contentType: string,
  bytes: ArrayBuffer,
) {
  if (!isApiEnabled) {
    addLocalDocument(applicationId, fieldKey);
    return `local-doc-${fieldKey}`;
  }
  const session = await createProviderKycUploadSession(applicationId, {
    fieldKey,
    kind: contentType.startsWith('image/') ? 'image' : 'document',
    filename,
    contentType,
    byteSize: bytes.byteLength,
  });

  await apiRequest(
    `/v1/provider/applications/${applicationId}/kyc-upload-sessions/${session.sessionId}/content`,
    {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: bytes,
    },
  );

  await completeProviderKycUpload(applicationId, session.sessionId, fieldKey);
  return session.mediaId;
}

export async function completeProviderKycUpload(
  applicationId: string,
  sessionId: string,
  fieldKey: string,
) {
  ensureAuthToken();
  return apiRequest<{ mediaId: string }>(
    `/v1/provider/applications/${applicationId}/kyc-upload-sessions/${sessionId}/complete`,
    { method: 'POST', body: JSON.stringify({ fieldKey }) },
  );
}

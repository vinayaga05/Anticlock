import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProviderApplicationRequest,
  ProviderBusinessDetail,
  ProviderBusinessSummary,
  UpdateProviderBusinessRequest,
  ProviderApplicationDetail,
  ProviderApplicationSummary,
  ProviderKind,
  ResolvedProviderFormSchema,
  SetProviderApplicationServicesRequest,
  UpdateProviderApplicationRequest,
} from '@/features/provider-onboarding/types';
import {
  createLocalApplication,
  deleteLocalApplication,
  getLocalApplication,
  getLocalApplications,
  reopenLocalApplication,
  removeLocalDocument,
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

export function useProviderApplicationsQuery() {
  return useQuery({
    queryKey: ['provider', 'applications', isApiEnabled ? 'api' : 'local'],
    queryFn: async () => {
      // Every application is a business in progress, drafts included.
      if (!isApiEnabled) return getLocalApplications();
      ensureAuthToken();
      const res = await apiRequest<{ applications: ProviderApplicationSummary[] }>(
        '/v1/provider/applications',
      );
      return res.applications;
    },
  });
}

export function useProviderApplicationQuery(applicationId: string) {
  return useQuery({
    queryKey: ['provider', 'application', applicationId, isApiEnabled ? 'api' : 'local'],
    enabled: Boolean(applicationId),
    queryFn: async () => {
      if (!isApiEnabled) {
        return getLocalApplication(applicationId);
      }
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail }>(
        `/v1/provider/applications/${applicationId}`,
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
      qc.invalidateQueries({ queryKey: ['provider'] });
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
      qc.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}

/**
 * Draft autosave: writes the response straight into the detail cache
 * instead of invalidating every provider query on each keystroke burst.
 */
export function useAutosaveProviderApplicationMutation(applicationId: string) {
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
    onSuccess: application => {
      if (application) {
        qc.setQueryData(
          ['provider', 'application', applicationId, isApiEnabled ? 'api' : 'local'],
          application,
        );
      }
      qc.invalidateQueries({ queryKey: ['provider', 'applications'] });
    },
  });
}

export async function deleteProviderDocument(applicationId: string, fieldKey: string) {
  if (!isApiEnabled) {
    removeLocalDocument(applicationId, fieldKey);
    return;
  }
  ensureAuthToken();
  await apiRequest<{ ok: true }>(
    `/v1/provider/applications/${applicationId}/documents/${encodeURIComponent(fieldKey)}`,
    { method: 'DELETE' },
  );
}

/** Rejected -> draft again so the applicant can fix and resubmit. */
export function useReopenProviderApplicationMutation(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) return reopenLocalApplication(applicationId);
      ensureAuthToken();
      const res = await apiRequest<{ application: ProviderApplicationDetail }>(
        `/v1/provider/applications/${applicationId}/reopen`,
        { method: 'POST' },
      );
      return res.application;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}

/** Approved businesses the user owns or manages. */
export function useMyBusinessesQuery() {
  return useQuery({
    queryKey: ['provider', 'businesses', isApiEnabled ? 'api' : 'local'],
    queryFn: async (): Promise<ProviderBusinessSummary[]> => {
      if (!isApiEnabled) return [];
      ensureAuthToken();
      const res = await apiRequest<{ businesses: ProviderBusinessSummary[] }>(
        '/v1/provider/businesses',
      );
      return res.businesses;
    },
  });
}

export function useMyBusinessQuery(providerId: string | undefined) {
  return useQuery({
    queryKey: ['provider', 'business', providerId, isApiEnabled ? 'api' : 'local'],
    enabled: Boolean(providerId) && isApiEnabled,
    queryFn: async () => {
      ensureAuthToken();
      const res = await apiRequest<{ business: ProviderBusinessDetail }>(
        `/v1/provider/businesses/${providerId}`,
      );
      return res.business;
    },
  });
}

export function useUpdateMyBusinessMutation(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProviderBusinessRequest) => {
      ensureAuthToken();
      const res = await apiRequest<{ business: ProviderBusinessDetail }>(
        `/v1/provider/businesses/${providerId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      return res.business;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider', 'business'] });
      qc.invalidateQueries({ queryKey: ['provider', 'businesses'] });
      qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useDeleteProviderApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      if (!isApiEnabled) {
        deleteLocalApplication(applicationId);
        return;
      }
      ensureAuthToken();
      await apiRequest<{ ok: true }>(`/v1/provider/applications/${applicationId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider'] });
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
      qc.invalidateQueries({ queryKey: ['provider'] });
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
      qc.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}

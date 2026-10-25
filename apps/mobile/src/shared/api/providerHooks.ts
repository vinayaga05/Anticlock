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
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';
import type { Booking, ProviderBookingActionRequest } from '@anticlock/contracts';

function ensureAuthToken() {
  if (!isApiEnabled) {
    throw new Error('Service provider features require a connection to Anticlock.');
  }
  const session = readStoredSession();
  if (!session?.token) {
    throw new Error('Not authenticated');
  }
}

export function useMyProviderApplicationQuery() {
  return useQuery({
    queryKey: ['provider', 'application', 'me', 'api'],
    queryFn: async () => {
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
    queryKey: ['provider', 'applications', 'api'],
    queryFn: async () => {
      // Every application is a business in progress, drafts included.
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
    queryKey: ['provider', 'application', applicationId, 'api'],
    enabled: Boolean(applicationId),
    queryFn: async () => {
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
      'api',
    ],
    queryFn: async () => {
      if (!providerKind || !categoryIds.length) return null;
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
          ['provider', 'application', applicationId, 'api'],
          application,
        );
      }
      qc.invalidateQueries({ queryKey: ['provider', 'applications'] });
    },
  });
}

export async function deleteProviderDocument(applicationId: string, fieldKey: string) {
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
    queryKey: ['provider', 'businesses', 'api'],
    queryFn: async (): Promise<ProviderBusinessSummary[]> => {
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
    queryKey: ['provider', 'business', providerId, 'api'],
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

export function useProviderBookingActionMutation(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      ...body
    }: ProviderBookingActionRequest & { bookingId: string }) => {
      ensureAuthToken();
      const res = await apiRequest<{ booking: Booking }>(
        `/v1/provider/businesses/${providerId}/bookings/${bookingId}/action`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider', 'business', providerId] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteProviderApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
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

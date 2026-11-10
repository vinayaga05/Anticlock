import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateExploreEventRequest,
  ExploreEvent,
  ExploreEventListResponse,
  UpdateExploreEventRequest,
} from '@anticlock/contracts';
import { apiRequest } from './client';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';

type Viewer = { id: string; type: PublisherProfileType } | undefined;

function viewerParams(viewer: Viewer) {
  const params = new URLSearchParams();
  if (viewer) {
    params.set('viewerProfileId', viewer.id);
    params.set('viewerProfileType', viewer.type);
  }
  return params;
}

export function useExploreEventsQuery(options: {
  search?: string;
  categoryId?: string;
  following?: boolean;
  freeOnly?: boolean;
  viewer?: Viewer;
} = {}) {
  return useQuery({
    queryKey: ['explore', 'events', options],
    queryFn: async () => {
      const params = viewerParams(options.viewer);
      if (options.search) params.set('search', options.search);
      if (options.categoryId) params.set('categoryId', options.categoryId);
      if (options.following) params.set('following', 'true');
      if (options.freeOnly) params.set('freeOnly', 'true');
      params.set('startsAfter', new Date().toISOString());
      params.set('limit', '50');
      return apiRequest<ExploreEventListResponse>(`/v1/explore/events?${params}`);
    },
  });
}

export function useMyExploreEventsQuery() {
  return useQuery({
    queryKey: ['explore', 'events', 'mine'],
    queryFn: async () =>
      apiRequest<{ events: ExploreEvent[] }>('/v1/explore/events/mine'),
  });
}

export function useSavedExploreEventsQuery(viewer?: Viewer) {
  return useQuery({
    queryKey: ['explore', 'events', 'saved', viewer],
    queryFn: async () => {
      const params = viewerParams(viewer);
      return apiRequest<{ events: ExploreEvent[] }>(
        `/v1/explore/events/saved${params.toString() ? `?${params}` : ''}`,
      );
    },
  });
}

export function useExploreEventQuery(id: string, viewer?: Viewer) {
  return useQuery({
    queryKey: ['explore', 'event', id, viewer],
    enabled: Boolean(id),
    queryFn: async () => {
      const params = viewerParams(viewer);
      const suffix = params.toString() ? `?${params}` : '';
      const response = await apiRequest<{ event: ExploreEvent }>(
        `/v1/explore/events/${id}${suffix}`,
      );
      return response.event;
    },
  });
}

export function useCreateExploreEventMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateExploreEventRequest) => {
      const response = await apiRequest<{ event: ExploreEvent }>('/v1/explore/events', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return response.event;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['explore', 'events'] }),
  });
}

export function useUpdateExploreEventMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, update }: { id: string; update: UpdateExploreEventRequest }) => {
      const response = await apiRequest<{ event: ExploreEvent }>(`/v1/explore/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      return response.event;
    },
    onSuccess: event => {
      client.setQueryData(['explore', 'event', event.id], event);
      client.invalidateQueries({ queryKey: ['explore', 'events'] });
    },
  });
}

export function useSubmitExploreEventMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest<{ event: ExploreEvent }>(`/v1/explore/events/${id}/submit`, {
        method: 'POST',
      });
      return response.event;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['explore', 'events'] }),
  });
}

export function useEventRegistrationMutation(id: string, viewer?: Viewer) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (registered: boolean) => {
      const params = viewerParams(viewer);
      const response = await apiRequest<{ event: ExploreEvent }>(
        `/v1/explore/events/${id}/register${params.toString() ? `?${params}` : ''}`,
        { method: registered ? 'DELETE' : 'POST' },
      );
      return response.event;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['explore', 'event', id] });
      client.invalidateQueries({ queryKey: ['explore', 'events'] });
    },
  });
}

export function useManageExploreEventMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'archive' | 'delete' }) => {
      if (action === 'archive') {
        const response = await apiRequest<{ event: ExploreEvent }>(`/v1/explore/events/${id}/archive`, { method: 'POST' });
        return response.event;
      }
      await apiRequest<{ success: true }>(`/v1/explore/events/${id}`, { method: 'DELETE' });
      return null;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['explore', 'events'] }),
  });
}

export function useSaveExploreEventMutation(id: string, viewer?: Viewer) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (saved: boolean) => {
      const params = viewerParams(viewer);
      const response = await apiRequest<{ event: ExploreEvent }>(
        `/v1/explore/events/${id}/save${params.toString() ? `?${params}` : ''}`,
        { method: saved ? 'DELETE' : 'POST' },
      );
      return response.event;
    },
    onSuccess: event => {
      client.invalidateQueries({ queryKey: ['explore', 'event', id] });
      client.invalidateQueries({ queryKey: ['explore', 'events'] });
      return event;
    },
  });
}

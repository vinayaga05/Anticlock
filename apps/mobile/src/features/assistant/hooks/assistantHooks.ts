import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import type { AssistantConversation, AssistantMessageRecord } from '@/features/assistant/types';

export function useAssistantConversations() {
  return useQuery({
    queryKey: ['assistant', 'conversations'],
    queryFn: () =>
      apiRequest<{ data: AssistantConversation[] }>('/v1/assistant/conversations'),
  });
}

export function useAssistantConversation(id: string | null) {
  return useQuery({
    queryKey: ['assistant', 'conversation', id],
    enabled: Boolean(id),
    queryFn: () =>
      apiRequest<{
        conversation: AssistantConversation;
        messages: AssistantMessageRecord[];
      }>(`/v1/assistant/conversations/${id}`),
  });
}

export function useDeleteAssistantConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ ok: boolean }>(`/v1/assistant/conversations/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assistant'] });
    },
  });
}

export function useDeleteAllAssistantHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean }>('/v1/assistant/history', { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assistant'] });
    },
  });
}

export function useExportAssistantData() {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ data: unknown; exportedAt: string }>(
        '/v1/assistant/conversations/export',
      ),
  });
}

export function useTrackAssistantAnalytics() {
  return useMutation({
    mutationFn: (body: {
      conversationId?: string;
      event: Record<string, unknown>;
    }) =>
      apiRequest<{ ok: boolean }>('/v1/assistant/analytics', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

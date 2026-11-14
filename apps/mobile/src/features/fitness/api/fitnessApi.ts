import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/context/AuthProvider';
import { ApiError, getApiToken } from '@/shared/api/client';
import { getApiBaseUrl, isApiEnabled } from '@/shared/api/config';
import { getStoredSession } from '@/shared/services/storage';
import { isSessionExpired } from '@/shared/services/auth/types';

export type FitnessSession = { userId: string; token: string };
export const FITNESS_PREFIX = '/v1/fitness';

export function fitnessSession(userId?: string): FitnessSession {
  const session = getStoredSession();
  const token = getApiToken();
  if (
    !userId ||
    userId === 'temporary-guest' ||
    !session ||
    session.user.id !== userId ||
    !token ||
    session.token !== token ||
    isSessionExpired(session.expiresAt)
  ) {
    throw new ApiError(
      401,
      'unauthorized',
      'Sign in to open your private fitness space.',
    );
  }
  return { userId, token };
}
export function assertFitnessSession(expected: FitnessSession) {
  const current = fitnessSession(expected.userId);
  if (current.token !== expected.token)
    throw new ApiError(
      0,
      'session_changed',
      'Your account changed. Reopen Fitness to continue.',
    );
}

/** One deadline covers headers, error bodies and successful JSON. */
export async function fitnessRequest<T>(
  path: string,
  init: RequestInit = {},
  session?: FitnessSession,
): Promise<T> {
  if (!isApiEnabled)
    throw new ApiError(
      0,
      'api_disabled',
      'Fitness is unavailable until the service is connected.',
    );
  const active = session ?? fitnessSession(getStoredSession()?.user.id);
  assertFitnessSession(active);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const cancelled = () =>
    Object.assign(new Error('Request cancelled.'), { name: 'AbortError' });
  if (init.signal?.aborted) throw cancelled();
  try {
    const result = await Promise.race([
      (async () => {
        const response = await fetch(
          `${getApiBaseUrl()}${
            path.startsWith('/v1/') || path === '/auth/mobile/account'
              ? path
              : FITNESS_PREFIX + path
          }`,
          {
            ...init,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${active.token}`,
              ...init.headers,
            },
          },
        );
        const body = await response.json().catch(() => {
          throw new ApiError(
            response.status >= 400 ? response.status : 503,
            'invalid_response',
            'Fitness could not be loaded. Your entry is still here; please try again.',
          );
        });
        if (!response.ok)
          throw new ApiError(
            response.status,
            body.error?.code ?? 'request_failed',
            body.error?.message ?? 'Fitness could not be loaded. Try again.',
          );
        return body as T;
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new ApiError(
              0,
              'request_timeout',
              'This request timed out. Your entry is still here; try again.',
            ),
          );
        }, 25_000);
        cancel = () => {
          controller.abort();
          reject(cancelled());
        };
        init.signal?.addEventListener('abort', cancel, { once: true });
      }),
    ]);
    assertFitnessSession(active);
    return result;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (cancel) init.signal?.removeEventListener('abort', cancel);
  }
}

export function useFitnessQuery<T>(path: string, enabled = true) {
  const { user } = useAuth();
  const token = getApiToken();
  return useQuery<T, Error>({
    queryKey: ['fitness', user?.id, token, path],
    enabled: enabled && Boolean(user && user.id !== 'temporary-guest' && token),
    queryFn: ({ signal }) =>
      fitnessRequest<T>(path, { signal }, fitnessSession(user?.id)),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useFitnessMutation<T = unknown>() {
  const { user } = useAuth();
  const client = useQueryClient();
  const pending = useRef(false);
  return useMutation<
    T,
    Error,
    {
      path: string;
      method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
    }
  >({
    mutationFn: async ({ path, method = 'POST', body }) => {
      if (pending.current)
        throw new Error('Your previous entry is still saving.');
      pending.current = true;
      try {
        return await fitnessRequest<T>(
          path,
          {
            method,
            body: body === undefined ? undefined : JSON.stringify(body),
          },
          fitnessSession(user?.id),
        );
      } finally {
        pending.current = false;
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['fitness', user?.id] });
    },
  });
}

export function newFitnessRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

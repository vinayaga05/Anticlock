import { getRedis } from '../../lib/redis.js';
import { AiProviderError, type AiFailureCategory } from './types.js';
import type { AiProviderName } from '../../config/ai-provider.config.js';

export function classifyProviderError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;

  const status = (err as { status?: number }).status;
  const message =
    err instanceof Error ? err.message : 'Unknown provider error';

  if (message.toLowerCase().includes('abort') || message.includes('timeout')) {
    return new AiProviderError(message, 'timeout', status, true);
  }
  if (status === 429) {
    return new AiProviderError(message, 'rate_limit', status, true);
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(message, 'auth_error', status, false);
  }
  if (status === 400 || status === 422) {
    return new AiProviderError(message, 'validation_error', status, false);
  }
  if (status !== undefined && status >= 500) {
    return new AiProviderError(message, 'server_error', status, true);
  }
  return new AiProviderError(message, 'unknown', status, false);
}

export async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function backoffDelayMs(attempt: number) {
  const base = Math.min(1000 * 2 ** attempt, 8000);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

const CIRCUIT_FAIL_THRESHOLD = 5;
const CIRCUIT_WINDOW_SEC = 60;
const CIRCUIT_OPEN_SEC = 30;

export async function assertCircuitClosed(provider: AiProviderName) {
  const redis = getRedis();
  if (redis.status !== 'ready') await redis.connect();
  const openKey = `ai:circuit:${provider}:open`;
  const isOpen = await redis.get(openKey);
  if (isOpen) {
    throw new AiProviderError(
      `Provider ${provider} is temporarily unavailable`,
      'server_error',
      503,
      true,
    );
  }
}

export async function recordProviderFailure(provider: AiProviderName) {
  const redis = getRedis();
  if (redis.status !== 'ready') await redis.connect();
  const countKey = `ai:circuit:${provider}:failures`;
  const count = await redis.incr(countKey);
  if (count === 1) await redis.expire(countKey, CIRCUIT_WINDOW_SEC);
  if (count >= CIRCUIT_FAIL_THRESHOLD) {
    await redis.set(`ai:circuit:${provider}:open`, '1', 'EX', CIRCUIT_OPEN_SEC);
    await redis.del(countKey);
  }
}

export async function recordProviderSuccess(provider: AiProviderName) {
  const redis = getRedis();
  if (redis.status !== 'ready') await redis.connect();
  await redis.del(`ai:circuit:${provider}:failures`);
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function sanitizeForLogs(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/gsk_[A-Za-z0-9]+/g, '[REDACTED_GROQ_KEY]').replace(
      /sk-[A-Za-z0-9]+/g,
      '[REDACTED_OPENAI_KEY]',
    );
  }
  if (Array.isArray(value)) return value.map(sanitizeForLogs);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        k.toLowerCase().includes('key') || k.toLowerCase().includes('authorization')
          ? '[REDACTED]'
          : sanitizeForLogs(v),
      ]),
    );
  }
  return value;
}

export type { AiFailureCategory };

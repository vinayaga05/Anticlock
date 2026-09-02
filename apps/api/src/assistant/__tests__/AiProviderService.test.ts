import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForLogs } from '../ai/resilience.js';
import { AiProviderError } from '../ai/types.js';

describe('AiProviderService resilience helpers', () => {
  it('sanitizes api keys from log payloads', () => {
    const sanitized = sanitizeForLogs({
      apiKey: 'gsk_secret',
      authorization: 'Bearer sk-secret',
      nested: { OPENAI_API_KEY: 'sk-secret' },
    }) as Record<string, unknown>;
    assert.equal(sanitized.apiKey, '[REDACTED]');
    assert.equal(sanitized.authorization, '[REDACTED]');
  });

  it('marks auth errors as non-retryable', () => {
    const err = new AiProviderError('invalid key', 'auth_error', 401, false);
    assert.equal(err.retryable, false);
    assert.equal(err.category, 'auth_error');
  });

  it('marks server errors as retryable', () => {
    const err = new AiProviderError('upstream unavailable', 'server_error', 503, true);
    assert.equal(err.retryable, true);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadAiProviderConfig } from './ai-provider.config.js';

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    AI_PROVIDER: undefined,
    GROQ_API_KEY: 'gsk_test_key',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    OPENAI_API_KEY: 'sk-test-key',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_MODEL: 'gpt-4.1-mini',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe('loadAiProviderConfig', () => {
  it('defaults to groq when AI_PROVIDER is absent', () => {
    const config = loadAiProviderConfig(baseEnv());
    assert.equal(config.activeProvider, 'groq');
    assert.equal(config.groq.model, 'openai/gpt-oss-20b');
  });

  it('uses openai when AI_PROVIDER=openai', () => {
    const config = loadAiProviderConfig(baseEnv({ AI_PROVIDER: 'openai' }));
    assert.equal(config.activeProvider, 'openai');
    assert.equal(config.openai.model, 'gpt-4.1-mini');
  });

  it('requires GROQ_API_KEY when groq is selected', () => {
    assert.throws(
      () => loadAiProviderConfig(baseEnv({ GROQ_API_KEY: '' })),
      /GROQ_API_KEY is required/,
    );
  });

  it('requires OPENAI_API_KEY when openai is selected', () => {
    assert.throws(
      () =>
        loadAiProviderConfig(
          baseEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '' }),
        ),
      /OPENAI_API_KEY is required/,
    );
  });

  it('requires fallback provider credentials when configured', () => {
    assert.throws(
      () =>
        loadAiProviderConfig(
          baseEnv({ AI_FALLBACK_PROVIDER: 'openai', OPENAI_API_KEY: '' }),
        ),
      /OPENAI_API_KEY is required/,
    );
  });
});

import { z } from 'zod';
import { assertModelSupportsTools, getModelCapabilities } from '../assistant/ai/model-capabilities.js';

const envSchema = z.object({
  AI_PROVIDER: z.enum(['groq', 'openai']).default('groq'),
  AI_FALLBACK_PROVIDER: z.enum(['groq', 'openai']).optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
});

export type AiProviderName = 'groq' | 'openai';

export type AiProviderConfig = {
  activeProvider: AiProviderName;
  fallbackProvider?: AiProviderName;
  requestTimeoutMs: number;
  maxRetries: number;
  groq: {
    apiKey?: string;
    baseURL: string;
    model: string;
  };
  openai: {
    apiKey?: string;
    baseURL: string;
    model: string;
  };
};

function requireKey(
  provider: AiProviderName,
  key: string | undefined,
  label: string,
) {
  if (!key?.trim()) {
    throw new Error(`${label} is required when ${provider} is configured.`);
  }
}

export function loadAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig {
  const parsed = envSchema.parse(env);

  if (parsed.AI_PROVIDER === 'groq') {
    requireKey('groq', parsed.GROQ_API_KEY, 'GROQ_API_KEY');
  }
  if (parsed.AI_PROVIDER === 'openai') {
    requireKey('openai', parsed.OPENAI_API_KEY, 'OPENAI_API_KEY');
  }
  if (parsed.AI_FALLBACK_PROVIDER === 'groq') {
    requireKey('groq', parsed.GROQ_API_KEY, 'GROQ_API_KEY');
  }
  if (parsed.AI_FALLBACK_PROVIDER === 'openai') {
    requireKey('openai', parsed.OPENAI_API_KEY, 'OPENAI_API_KEY');
  }

  const activeModel =
    parsed.AI_PROVIDER === 'groq' ? parsed.GROQ_MODEL : parsed.OPENAI_MODEL;
  assertModelSupportsTools(activeModel);

  if (parsed.AI_FALLBACK_PROVIDER) {
    const fallbackModel =
      parsed.AI_FALLBACK_PROVIDER === 'groq'
        ? parsed.GROQ_MODEL
        : parsed.OPENAI_MODEL;
    assertModelSupportsTools(fallbackModel);
  }

  return {
    activeProvider: parsed.AI_PROVIDER,
    fallbackProvider: parsed.AI_FALLBACK_PROVIDER,
    requestTimeoutMs: parsed.AI_REQUEST_TIMEOUT_MS,
    maxRetries: parsed.AI_MAX_RETRIES,
    groq: {
      apiKey: parsed.GROQ_API_KEY,
      baseURL: parsed.GROQ_BASE_URL,
      model: parsed.GROQ_MODEL,
    },
    openai: {
      apiKey: parsed.OPENAI_API_KEY,
      baseURL: parsed.OPENAI_BASE_URL,
      model: parsed.OPENAI_MODEL,
    },
  };
}

export function logAiProviderStartup(config: AiProviderConfig) {
  const activeModel =
    config.activeProvider === 'groq' ? config.groq.model : config.openai.model;
  console.log(
    JSON.stringify({
      event: 'ai_provider_ready',
      provider: config.activeProvider,
      model: activeModel,
      fallbackProvider: config.fallbackProvider ?? null,
    }),
  );
}

export function getProviderModel(config: AiProviderConfig, provider: AiProviderName) {
  return provider === 'groq' ? config.groq.model : config.openai.model;
}

export function getModelCapabilitiesForConfig(
  config: AiProviderConfig,
  provider: AiProviderName,
) {
  return getModelCapabilities(getProviderModel(config, provider));
}

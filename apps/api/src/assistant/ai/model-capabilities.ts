export type ModelCapabilities = {
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsJsonSchema: boolean;
  supportsResponsesApi?: boolean;
  contextWindow?: number;
};

const REGISTRY: Record<string, ModelCapabilities> = {
  'llama-3.3-70b-versatile': {
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonSchema: false,
    contextWindow: 128_000,
  },
  'llama-3.1-8b-instant': {
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonSchema: false,
    contextWindow: 128_000,
  },
  'gpt-4.1-mini': {
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsResponsesApi: true,
    contextWindow: 128_000,
  },
  'gpt-4o-mini': {
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonSchema: true,
    supportsResponsesApi: true,
    contextWindow: 128_000,
  },
};

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsTools: true,
  supportsStreaming: true,
  supportsJsonSchema: false,
};

export function getModelCapabilities(model: string): ModelCapabilities {
  return REGISTRY[model] ?? DEFAULT_CAPABILITIES;
}

export function assertModelSupportsTools(model: string) {
  const caps = getModelCapabilities(model);
  if (!caps.supportsTools) {
    throw new Error(`Model "${model}" does not support tool calling.`);
  }
}

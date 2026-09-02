import type { AiProviderName } from '../../config/ai-provider.config.js';

export type AgentToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AgentMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: AgentToolCall[];
};

export type AssistantAgentInput = {
  systemPrompt: string;
  messages: AgentMessage[];
  previousResponseId?: string;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AssistantAgentOutput = {
  provider: AiProviderName;
  model: string;
  text: string;
  toolCalls: AgentToolCall[];
  responseId?: string;
  usage?: TokenUsage;
};

export type AiFailureCategory =
  | 'timeout'
  | 'rate_limit'
  | 'server_error'
  | 'auth_error'
  | 'validation_error'
  | 'capability_error'
  | 'unknown';

export type ProviderCallTelemetry = {
  provider: AiProviderName;
  model: string;
  fallbackUsed: boolean;
  failureCategory?: AiFailureCategory;
  latencyMs: number;
  tokenUsage?: TokenUsage;
};

export interface AiProvider {
  readonly provider: AiProviderName;
  readonly model: string;
  generateAssistantResponse(input: AssistantAgentInput): Promise<AssistantAgentOutput>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly category: AiFailureCategory,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

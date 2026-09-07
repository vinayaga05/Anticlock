import { randomUUID } from 'node:crypto';
import { assistantRepository } from './AssistantRepository.js';
import { sanitizeForLogs } from './ai/resilience.js';

export type AgentRunTrace = {
  id: string;
  startedAt: number;
  sequence: number;
};

type AgentTraceRepository = {
  trackServerTrace(
    mobileUserId: string,
    conversationId: string | null,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<unknown>;
};

type TraceEvent =
  | 'agent_run_started'
  | 'provider_completed'
  | 'provider_failed'
  | 'tool_completed'
  | 'guardrail_triggered'
  | 'agent_run_completed'
  | 'agent_run_failed';

const REDACTED_KEYS = new Set([
  'message',
  'content',
  'query',
  'prompt',
  'authorization',
  'apikey',
  'lat',
  'lng',
  'coordinates',
]);

export function safeTracePayload(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map(item => safeTracePayload(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase())
          ? '[REDACTED]'
          : safeTracePayload(item, depth + 1),
      ]),
    );
  }
  if (typeof value === 'string') return value.slice(0, 200);
  return value;
}

/**
 * Server-only, privacy-safe run tracing. It shares the existing append-only
 * analytics store but uses an internal repository method, so clients cannot
 * create or spoof trace records through the analytics endpoint.
 */
export class AgentTraceService {
  constructor(
    private readonly repository: AgentTraceRepository = assistantRepository,
  ) {}

  start(
    userId: string,
    conversationId: string,
    input: {
      clientRequestId?: string;
      personaVersion: string;
      currentScreen?: string;
      queryFingerprint: string;
    },
  ): AgentRunTrace {
    const trace = { id: randomUUID(), startedAt: Date.now(), sequence: 0 };
    void this.record(userId, conversationId, trace, 'agent_run_started', input);
    return trace;
  }

  providerCompleted(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    input: {
      turn: number;
      provider: string;
      model: string;
      latencyMs: number;
      fallbackUsed: boolean;
    },
  ) {
    void this.record(userId, conversationId, trace, 'provider_completed', input);
  }

  providerFailed(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    input: { turn: number; code: string },
  ) {
    void this.record(userId, conversationId, trace, 'provider_failed', input);
  }

  toolCompleted(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    input: {
      turn: number;
      toolName: string;
      success: boolean;
      latencyMs: number;
    },
  ) {
    void this.record(userId, conversationId, trace, 'tool_completed', input);
  }

  guardrailTriggered(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    input: { stage: 'input' | 'output' | 'tool'; rule: string; action: string },
  ) {
    void this.record(userId, conversationId, trace, 'guardrail_triggered', input);
  }

  complete(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    input: { turns: number; toolCallCount: number; outcome: 'success' | 'no_results' },
  ) {
    void this.record(userId, conversationId, trace, 'agent_run_completed', {
      ...input,
      latencyMs: Date.now() - trace.startedAt,
    });
  }

  fail(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    input: { code: string; turns: number },
  ) {
    void this.record(userId, conversationId, trace, 'agent_run_failed', {
      ...input,
      latencyMs: Date.now() - trace.startedAt,
    });
  }

  private async record(
    userId: string,
    conversationId: string,
    trace: AgentRunTrace,
    event: TraceEvent,
    payload: Record<string, unknown>,
  ) {
    const sequence = (trace.sequence += 1);
    const safePayload = safeTracePayload({
      traceId: trace.id,
      sequence,
      ...payload,
    }) as Record<string, unknown>;
    try {
      await this.repository.trackServerTrace(userId, conversationId, event, safePayload);
    } catch (error) {
      // Observability must never prevent a user from chatting with Genie.
      console.warn(
        JSON.stringify(
          sanitizeForLogs({ event: 'genie_trace_write_failed', traceId: trace.id, error }),
        ),
      );
    }
  }
}

export const agentTraceService = new AgentTraceService();

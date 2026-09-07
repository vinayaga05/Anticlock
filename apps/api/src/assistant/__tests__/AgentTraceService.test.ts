import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentTraceService, safeTracePayload } from '../AgentTraceService.js';

describe('agent run tracing', () => {
  it('retains diagnostics while removing raw chat, secrets, and coordinates', () => {
    const payload = safeTracePayload({
      traceId: 'trace-1',
      provider: 'groq',
      model: 'model-1',
      message: 'find a doctor in Chennai',
      query: 'doctor',
      authorization: 'Bearer secret',
      apiKey: 'sk-secret',
      locationHint: { lat: 12.9, lng: 77.5, label: 'Chennai' },
    }) as Record<string, unknown>;

    assert.equal(payload.provider, 'groq');
    assert.equal(payload.model, 'model-1');
    assert.equal(payload.message, '[REDACTED]');
    assert.equal(payload.query, '[REDACTED]');
    assert.equal(payload.authorization, '[REDACTED]');
    assert.equal(payload.apiKey, '[REDACTED]');
    assert.deepEqual(payload.locationHint, {
      lat: '[REDACTED]',
      lng: '[REDACTED]',
      label: 'Chennai',
    });
  });

  it('correlates trace events with an ordered, server-owned run id', async () => {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const service = new AgentTraceService({
      async trackServerTrace(_userId, _conversationId, type, payload) {
        events.push({ type, payload });
      },
    });

    const trace = service.start('user-1', 'conversation-1', {
      personaVersion: '1',
      queryFingerprint: 'q_abc',
    });
    service.toolCompleted('user-1', 'conversation-1', trace, {
      turn: 1,
      toolName: 'search_reels',
      success: true,
      latencyMs: 12,
    });
    service.complete('user-1', 'conversation-1', trace, {
      turns: 1,
      toolCallCount: 1,
      outcome: 'success',
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(events.map(event => event.type), [
      'agent_run_started',
      'tool_completed',
      'agent_run_completed',
    ]);
    assert.deepEqual(events.map(event => event.payload.sequence), [1, 2, 3]);
    assert.equal(events.every(event => event.payload.traceId === trace.id), true);
  });
});

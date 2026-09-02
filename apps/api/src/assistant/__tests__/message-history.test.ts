import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentMessages } from '../ai/message-history.js';

describe('message-history', () => {
  it('builds identical chat message shape from session and db sources', () => {
    const systemPrompt = 'You are Genie';
    const sessionMessages = [
      { role: 'user' as const, content: 'hello', createdAt: '2026-01-01' },
      { role: 'assistant' as const, content: 'hi', createdAt: '2026-01-01' },
    ];
    const dbMessages = [
      { role: 'user', content: 'hello', toolCalls: null, toolResults: null },
      { role: 'assistant', content: 'hi', toolCalls: null, toolResults: null },
    ];

    const fromSession = buildAgentMessages({ systemPrompt, sessionMessages, dbMessages: [] });
    const fromDb = buildAgentMessages({ systemPrompt, sessionMessages: [], dbMessages });

    assert.deepEqual(fromSession, fromDb);
    assert.equal(fromSession[0]?.role, 'system');
    assert.equal(fromSession[1]?.role, 'user');
  });
});

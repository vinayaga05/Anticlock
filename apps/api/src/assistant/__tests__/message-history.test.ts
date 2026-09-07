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

  it('repairs legacy tool rows missing an assistant tool_calls turn', () => {
    const messages = buildAgentMessages({
      systemPrompt: 'You are Genie',
      sessionMessages: [],
      dbMessages: [
        {
          role: 'user',
          content: 'Show fitness trainer',
          toolCalls: null,
          toolResults: null,
        },
        {
          role: 'tool',
          content: null,
          toolCalls: [
            {
              id: 'fc_1',
              name: 'resolve_service_category',
              arguments: { query: 'fitness trainer' },
            },
          ],
          toolResults: [{ count: 0 }],
        },
        {
          role: 'assistant',
          content: 'Which area?',
          toolCalls: null,
          toolResults: null,
        },
      ],
    });

    assert.equal(messages[1]?.role, 'user');
    assert.equal(messages[2]?.role, 'assistant');
    assert.equal(messages[2]?.toolCalls?.[0]?.id, 'fc_1');
    assert.equal(messages[3]?.role, 'tool');
    assert.equal(messages[3]?.toolCallId, 'fc_1');
    assert.equal(messages[4]?.role, 'assistant');
    assert.equal(messages[4]?.content, 'Which area?');
  });
});

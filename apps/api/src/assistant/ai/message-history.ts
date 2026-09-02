import type { AgentMessage } from './types.js';
import type { SessionMessage } from '../SessionStore.js';

export function buildAgentMessages(input: {
  systemPrompt: string;
  sessionMessages: SessionMessage[];
  dbMessages: Array<{
    role: string;
    content: string | null;
    toolCalls: unknown[] | null;
    toolResults: unknown[] | null;
  }>;
}): AgentMessage[] {
  const messages: AgentMessage[] = [{ role: 'system', content: input.systemPrompt }];

  const source =
    input.dbMessages.length > 0
      ? input.dbMessages
      : input.sessionMessages.map(m => ({
          role: m.role,
          content: m.content,
          toolCalls: null as unknown[] | null,
          toolResults: null as unknown[] | null,
        }));

  for (const row of source) {
    if (row.role === 'user' && row.content) {
      messages.push({ role: 'user', content: row.content });
      continue;
    }
    if (row.role === 'assistant') {
      const toolCalls = (row.toolCalls ?? []) as Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
      }>;
      if (toolCalls.length) {
        messages.push({
          role: 'assistant',
          content: row.content ?? '',
          toolCalls,
        });
        const results = (row.toolResults ?? []) as unknown[];
        toolCalls.forEach((call, index) => {
          messages.push({
            role: 'tool',
            content: JSON.stringify(results[index] ?? {}),
            toolCallId: call.id,
          });
        });
      } else if (row.content) {
        messages.push({ role: 'assistant', content: row.content });
      }
      continue;
    }
    if (row.role === 'tool') {
      const toolCalls = (row.toolCalls ?? []) as Array<{ id: string }>;
      const results = (row.toolResults ?? []) as unknown[];
      toolCalls.forEach((call, index) => {
        messages.push({
          role: 'tool',
          content: JSON.stringify(results[index] ?? {}),
          toolCallId: call.id,
        });
      });
    }
  }

  return messages;
}

export function appendToolExchange(
  messages: AgentMessage[],
  toolCalls: AgentMessage['toolCalls'],
  toolResults: unknown[],
): AgentMessage[] {
  if (!toolCalls?.length) return messages;
  const next = [...messages, { role: 'assistant' as const, content: '', toolCalls }];
  for (let i = 0; i < toolCalls.length; i += 1) {
    next.push({
      role: 'tool',
      content: JSON.stringify(toolResults[i] ?? {}),
      toolCallId: toolCalls[i].id,
    });
  }
  return next;
}

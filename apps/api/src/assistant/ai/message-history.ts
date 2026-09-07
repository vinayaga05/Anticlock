import type { AgentMessage } from './types.js';
import type { SessionMessage } from '../SessionStore.js';

type HistoryToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

type HistoryRow = {
  role: string;
  content: string | null;
  toolCalls: unknown[] | null;
  toolResults: unknown[] | null;
};

function asToolCalls(value: unknown[] | null | undefined): HistoryToolCall[] {
  if (!value?.length) return [];
  return value
    .map(item => {
      const call = item as Partial<HistoryToolCall>;
      if (!call?.id || !call?.name) return null;
      return {
        id: String(call.id),
        name: String(call.name),
        arguments:
          call.arguments && typeof call.arguments === 'object'
            ? (call.arguments as Record<string, unknown>)
            : {},
      };
    })
    .filter((call): call is HistoryToolCall => Boolean(call));
}

function pushToolResults(
  messages: AgentMessage[],
  toolCalls: HistoryToolCall[],
  results: unknown[] | null | undefined,
  fallbackContent?: string | null,
) {
  toolCalls.forEach((call, index) => {
    const result = results?.[index];
    messages.push({
      role: 'tool',
      content:
        result !== undefined
          ? JSON.stringify(result)
          : fallbackContent?.trim()
            ? fallbackContent
            : '{}',
      toolCallId: call.id,
    });
  });
}

export function buildAgentMessages(input: {
  systemPrompt: string;
  sessionMessages: SessionMessage[];
  dbMessages: HistoryRow[];
}): AgentMessage[] {
  const messages: AgentMessage[] = [{ role: 'system', content: input.systemPrompt }];

  const source: HistoryRow[] =
    input.dbMessages.length > 0
      ? input.dbMessages
      : input.sessionMessages.map(m => ({
          role: m.role,
          content: m.content,
          toolCalls: null,
          toolResults: null,
        }));

  let pendingAssistantToolCallIds: string[] = [];

  for (const row of source) {
    if (row.role === 'user' && row.content) {
      pendingAssistantToolCallIds = [];
      messages.push({ role: 'user', content: row.content });
      continue;
    }

    if (row.role === 'assistant') {
      const toolCalls = asToolCalls(row.toolCalls);
      if (toolCalls.length) {
        messages.push({
          role: 'assistant',
          content: row.content ?? '',
          toolCalls,
        });
        pendingAssistantToolCallIds = toolCalls.map(call => call.id);
        // Legacy rows sometimes stored tool results on the assistant row.
        if (row.toolResults?.length) {
          pushToolResults(messages, toolCalls, row.toolResults);
          pendingAssistantToolCallIds = [];
        }
      } else if (row.content) {
        pendingAssistantToolCallIds = [];
        messages.push({ role: 'assistant', content: row.content });
      }
      continue;
    }

    if (row.role === 'tool') {
      const toolCalls = asToolCalls(row.toolCalls);
      if (!toolCalls.length) continue;

      const needsSyntheticAssistant = toolCalls.some(
        call => !pendingAssistantToolCallIds.includes(call.id),
      );
      // Repair older conversations that stored tool rows without the
      // matching assistant tool_calls turn (Groq/OpenAI reject that shape).
      if (needsSyntheticAssistant) {
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls,
        });
        pendingAssistantToolCallIds = toolCalls.map(call => call.id);
      }
      pushToolResults(messages, toolCalls, row.toolResults, row.content);
      const consumed = new Set(toolCalls.map(call => call.id));
      pendingAssistantToolCallIds = pendingAssistantToolCallIds.filter(
        id => !consumed.has(id),
      );
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

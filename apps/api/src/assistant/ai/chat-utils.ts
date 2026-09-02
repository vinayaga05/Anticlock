import type { ChatCompletionMessage } from 'openai/resources/chat/completions';

export function parseChatCompletionToolCalls(
  toolCalls: ChatCompletionMessage['tool_calls'],
): { id: string; name: string; arguments: Record<string, unknown> }[] {
  if (!toolCalls?.length) return [];

  return toolCalls.flatMap(call => {
    if (call.type !== 'function') return [];
    return [
      {
        id: call.id,
        name: call.function.name,
        arguments: JSON.parse(call.function.arguments || '{}') as Record<string, unknown>,
      },
    ];
  });
}

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ASSISTANT_TOOLS_CHAT } from '../tools/definitions.js';
import type {
  AiProvider,
  AssistantAgentInput,
  AssistantAgentOutput,
} from './types.js';
import { AiProviderError } from './types.js';
import { classifyProviderError } from './resilience.js';
import { parseChatCompletionToolCalls } from './chat-utils.js';

function toChatMessages(input: AssistantAgentInput): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: input.systemPrompt },
  ];

  for (const msg of input.messages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
      continue;
    }
    if (msg.role === 'assistant') {
      if (msg.toolCalls?.length) {
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(call => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          })),
        });
      } else {
        messages.push({ role: 'assistant', content: msg.content });
      }
      continue;
    }
    if (msg.role === 'tool' && msg.toolCallId) {
      messages.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content,
      });
    }
  }

  return messages;
}

export class GroqAiProvider implements AiProvider {
  readonly provider = 'groq' as const;
  private client: OpenAI;

  constructor(
    readonly model: string,
    apiKey: string,
    baseURL: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generateAssistantResponse(
    input: AssistantAgentInput,
    signal?: AbortSignal,
  ): Promise<AssistantAgentOutput> {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: toChatMessages(input),
          tools: ASSISTANT_TOOLS_CHAT as ChatCompletionTool[],
          tool_choice: 'auto',
        },
        { signal },
      );

      const choice = completion.choices[0];
      const message = choice?.message;
      const toolCalls = parseChatCompletionToolCalls(message?.tool_calls);

      return {
        provider: this.provider,
        model: this.model,
        text: message?.content?.trim() ?? '',
        toolCalls,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (err) {
      throw classifyProviderError(err);
    }
  }
}

export function createGroqProvider(
  apiKey: string,
  baseURL: string,
  model: string,
): GroqAiProvider {
  if (!apiKey.trim()) {
    throw new AiProviderError('Groq API key is missing', 'auth_error', 401, false);
  }
  return new GroqAiProvider(model, apiKey, baseURL);
}

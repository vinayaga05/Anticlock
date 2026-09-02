import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import {
  getModelCapabilities,
} from './model-capabilities.js';
import { ASSISTANT_TOOLS_CHAT, ASSISTANT_TOOLS_RESPONSES } from '../tools/definitions.js';
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

export class OpenAiProvider implements AiProvider {
  readonly provider = 'openai' as const;
  private client: OpenAI;
  private useResponsesApi: boolean;

  constructor(
    readonly model: string,
    apiKey: string,
    baseURL: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.useResponsesApi = Boolean(getModelCapabilities(model).supportsResponsesApi);
  }

  async generateAssistantResponse(
    input: AssistantAgentInput,
    signal?: AbortSignal,
  ): Promise<AssistantAgentOutput> {
    if (this.useResponsesApi && input.previousResponseId !== undefined) {
      try {
        return await this.generateViaResponses(input, signal);
      } catch (err) {
        const classified = classifyProviderError(err);
        if (classified.retryable || classified.category === 'capability_error') {
          return this.generateViaChatCompletions(input, signal);
        }
        throw classified;
      }
    }

    if (this.useResponsesApi && !input.messages.some(m => m.role === 'tool')) {
      try {
        return await this.generateViaResponses(input, signal);
      } catch (err) {
        const classified = classifyProviderError(err);
        if (!classified.retryable && classified.category !== 'server_error') {
          throw classified;
        }
        return this.generateViaChatCompletions(input, signal);
      }
    }

    return this.generateViaChatCompletions(input, signal);
  }

  private async generateViaResponses(
    input: AssistantAgentInput,
    signal?: AbortSignal,
  ): Promise<AssistantAgentOutput> {
    const lastUser = [...input.messages].reverse().find(m => m.role === 'user');
    const response = await this.client.responses.create(
      {
        model: this.model,
        store: true,
        previous_response_id: input.previousResponseId,
        instructions: input.systemPrompt,
        input: lastUser?.content ?? '',
        tools: ASSISTANT_TOOLS_RESPONSES,
        tool_choice: 'auto',
      },
      { signal },
    );

    const toolCalls: AssistantAgentOutput['toolCalls'] = [];
    let text = '';

    for (const item of response.output ?? []) {
      if (item.type === 'message') {
        for (const part of item.content ?? []) {
          if (part.type === 'output_text') text += part.text;
        }
      }
      if (item.type === 'function_call') {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(item.arguments || '{}') as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        toolCalls.push({
          id: item.call_id ?? item.id ?? crypto.randomUUID(),
          name: item.name,
          arguments: parsed,
        });
      }
    }

    return {
      provider: this.provider,
      model: this.model,
      text: text.trim(),
      toolCalls,
      responseId: response.id,
    };
  }

  private async generateViaChatCompletions(
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

export function createOpenAiProvider(
  apiKey: string,
  baseURL: string,
  model: string,
): OpenAiProvider {
  if (!apiKey.trim()) {
    throw new AiProviderError('OpenAI API key is missing', 'auth_error', 401, false);
  }
  return new OpenAiProvider(model, apiKey, baseURL);
}

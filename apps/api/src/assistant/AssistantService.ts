import type {
  AssistantAnalyticsEvent,
  AssistantMessageRequest,
  AssistantStreamEvent,
} from '@anticlock/contracts';
import type { AuthClaims } from '../lib/auth.js';
import { loadAiProviderConfig } from '../config/ai-provider.config.js';
import { assistantRepository } from './AssistantRepository.js';
import { AiProviderService } from './ai/AiProviderService.js';
import { appendToolExchange, buildAgentMessages } from './ai/message-history.js';
import type { AgentMessage } from './ai/types.js';
import { AiProviderError } from './ai/types.js';
import { NAVIGATION_CATALOG } from './NavigationCatalog.js';
import { sessionStore } from './SessionStore.js';
import { toolExecutionService } from './ToolExecutionService.js';
import type { AssistantResultCard } from '@anticlock/contracts';

function requireMobile(auth: AuthClaims) {
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('A mobile session is required'), {
      code: 'forbidden',
      status: 403,
    });
  }
}

function buildInstructions(
  personaVersion: string,
  currentScreen: string | undefined,
  recentActions: string[],
  preferences: Record<string, string>,
) {
  const catalogSummary = NAVIGATION_CATALOG.map(
    c => `- ${c.route}: ${c.description} (aliases: ${c.aliases.join(', ')})`,
  ).join('\n');

  return `You are Genie, a navigation-first helper inside the Anticlock lifestyle services app.
Persona version: ${personaVersion}
Current screen: ${currentScreen ?? 'unknown'}
Recent actions: ${recentActions.join(', ') || 'none'}
User preferences: ${JSON.stringify(preferences)}

Available screens:
${catalogSummary}

Rules:
- Prefer tool calls over long explanations.
- When the user says "open the first/second/third one", use open_content with the matching item from recent results context.
- Keep replies concise (1-2 sentences).
- If a request is ambiguous, ask one clarifying question.
- Never invent routes outside the catalog.
- Never claim navigation or content actions succeeded unless a tool returns success.`;
}

async function* streamTextChunks(text: string): AsyncGenerator<AssistantStreamEvent> {
  const chunks = text.match(/.{1,24}/g) ?? [text];
  for (const chunk of chunks) {
    yield { type: 'token', delta: chunk };
    await new Promise(r => setTimeout(r, 8));
  }
}

export class AssistantService {
  private maxTurns = Number(process.env.ASSISTANT_MAX_TURNS ?? 8);
  private aiService: AiProviderService;

  constructor(config = loadAiProviderConfig()) {
    this.aiService = new AiProviderService(config);
  }

  async *chat(
    auth: AuthClaims,
    body: AssistantMessageRequest,
    opts: { idempotencyKey?: string; clientIp?: string } = {},
  ): AsyncGenerator<AssistantStreamEvent> {
    requireMobile(auth);
    const userId = auth.sub;

    if (opts.clientIp) {
      const ipAllowed = await sessionStore.checkIpRateLimit(opts.clientIp);
      if (!ipAllowed) {
        yield {
          type: 'error',
          code: 'rate_limited',
          message: 'Too many requests from this network. Please wait a moment.',
        };
        return;
      }
    }

    const allowed = await sessionStore.checkRateLimit(userId);
    if (!allowed) {
      yield {
        type: 'error',
        code: 'rate_limited',
        message: 'Too many requests. Please wait a moment.',
      };
      return;
    }

    if (opts.idempotencyKey) {
      const claimed = await sessionStore.claimIdempotencyKey(
        userId,
        opts.idempotencyKey,
      );
      if (!claimed) {
        yield {
          type: 'error',
          code: 'duplicate_request',
          message: 'This request was already processed.',
        };
        return;
      }
    }

    let conversation =
      body.conversationId
        ? await assistantRepository.getConversation(body.conversationId, userId)
        : null;

    if (!conversation) {
      conversation = await assistantRepository.createConversation(
        userId,
        body.currentScreen,
      );
    } else if (body.currentScreen) {
      await assistantRepository.updateConversation(conversation.id, {
        currentScreen: body.currentScreen,
      });
    }

    const conversationId = conversation.id;
    const session = await sessionStore.upsertSession(userId, conversationId, {
      currentScreen: body.currentScreen,
      personaVersion: conversation.personaVersion,
      lastResponseId: body.previousResponseId ?? conversation.lastResponseId ?? undefined,
    });

    await sessionStore.appendMessage(userId, conversationId, {
      role: 'user',
      content: body.message,
      createdAt: new Date().toISOString(),
    });

    await assistantRepository.insertMessage({
      conversationId,
      role: 'user',
      content: body.message,
    });

    await assistantRepository.trackAnalytics(userId, conversationId, {
      type: 'query_submitted',
      intent: body.message.slice(0, 80),
      confidence: 0.8,
    });

    const preferences = await sessionStore.getPreferences(userId);
    const instructions = buildInstructions(
      session.personaVersion,
      body.currentScreen,
      session.recentActions,
      preferences,
    );

    const sessionMessages = await sessionStore.getMessages(userId, conversationId);
    const dbMessages = await assistantRepository.listMessages(conversationId, 20);
    let agentMessages = buildAgentMessages({
      systemPrompt: instructions,
      sessionMessages,
      dbMessages: dbMessages.map(m => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls as unknown[] | null,
        toolResults: m.toolResults as unknown[] | null,
      })),
    });

    agentMessages.push({ role: 'user', content: body.message });

    const recentResults: AssistantResultCard[] = [];
    let previousResponseId =
      body.previousResponseId ?? conversation.lastResponseId ?? undefined;
    let finalText = '';
    let turns = 0;
    let mutatingToolsThisTurn = 0;

    while (turns < this.maxTurns) {
      turns += 1;

      let response;
      let telemetry;
      try {
        ({ output: response, telemetry } = await this.aiService.generateAssistantResponse({
          systemPrompt: instructions,
          messages: agentMessages.filter(m => m.role !== 'system'),
          previousResponseId,
        }));
      } catch (err) {
        const message =
          err instanceof AiProviderError
            ? 'Genie is temporarily unavailable. Please try again shortly.'
            : 'Something went wrong. Please try again.';
        yield { type: 'error', code: 'provider_error', message };
        await assistantRepository.trackAnalytics(userId, conversationId, {
          type: 'unresolved_intent',
          query: body.message.slice(0, 120),
          fallbackAction: 'provider_error',
        });
        return;
      }

      await assistantRepository.trackAnalytics(userId, conversationId, {
        type: 'provider_call',
        provider: telemetry.provider,
        model: telemetry.model,
        fallbackUsed: telemetry.fallbackUsed,
        latencyMs: telemetry.latencyMs,
        tokenUsage: telemetry.tokenUsage,
        failureCategory: telemetry.failureCategory,
      } as AssistantAnalyticsEvent);

      if (response.responseId) {
        previousResponseId = response.responseId;
        await assistantRepository.updateConversation(conversationId, {
          lastResponseId: response.responseId,
        });
        await sessionStore.upsertSession(userId, conversationId, {
          lastResponseId: response.responseId,
        });
      }

      if (response.toolCalls.length === 0) {
        finalText = response.text;
        for await (const evt of streamTextChunks(finalText)) yield evt;
        break;
      }

      const toolResultsForMessages: unknown[] = [];
      const executedCalls: AgentMessage['toolCalls'] = [];

      for (const call of response.toolCalls) {
        if (toolExecutionService.isMutatingTool(call.name)) {
          if (mutatingToolsThisTurn >= 1) {
            toolResultsForMessages.push({
              error: 'Only one navigation or open action is allowed per turn',
              code: 'mutating_tool_limit',
            });
            continue;
          }
          mutatingToolsThisTurn += 1;
        }

        const started = Date.now();
        const { result, events } = await toolExecutionService.execute(
          call.name,
          call.arguments,
          auth,
          conversationId,
          body.currentScreen,
          recentResults,
        );

        for (const evt of events) yield evt;

        await sessionStore.appendAction(
          userId,
          conversationId,
          `${call.name}:${JSON.stringify(call.arguments)}`,
        );

        await assistantRepository.trackAnalytics(userId, conversationId, {
          type: 'tool_called',
          toolName: call.name,
          success: result.ok,
          latencyMs: Date.now() - started,
        });

        toolResultsForMessages.push(result.ok ? result.data : { error: result.error, code: result.code });
        executedCalls.push(call);

        await assistantRepository.insertMessage({
          conversationId,
          role: 'tool',
          content: null,
          toolCalls: [call],
          toolResults: [result.ok ? result.data : { error: result.error, code: result.code }],
        });

        if (result.ok && result.navigation) {
          await assistantRepository.trackAnalytics(userId, conversationId, {
            type: 'navigation_completed',
            route: result.navigation.route,
            fromScreen: body.currentScreen,
          });
        }
      }

      agentMessages = appendToolExchange(
        agentMessages,
        executedCalls,
        toolResultsForMessages,
      );

      if (response.text) {
        finalText = response.text;
        for await (const evt of streamTextChunks(finalText)) yield evt;
        break;
      }
    }

    if (!finalText && turns >= this.maxTurns) {
      finalText = 'I need to stop here to avoid too many steps. Please try a simpler request.';
      yield { type: 'token', delta: finalText };
    }

    await assistantRepository.insertMessage({
      conversationId,
      role: 'assistant',
      content: finalText,
    });

    await sessionStore.appendMessage(userId, conversationId, {
      role: 'assistant',
      content: finalText,
      createdAt: new Date().toISOString(),
    });

    if (conversation.title === 'New conversation') {
      await assistantRepository.updateConversation(conversationId, {
        title: body.message.slice(0, 60),
      });
    }

    await assistantRepository.trackAnalytics(userId, conversationId, {
      type: 'conversation_resolved',
      turns,
      hadClarification: false,
    });

    yield {
      type: 'done',
      conversationId,
      responseId: previousResponseId,
      message: finalText,
    };
  }

  listConversations(auth: AuthClaims) {
    requireMobile(auth);
    return assistantRepository.listConversations(auth.sub);
  }

  async getConversation(auth: AuthClaims, id: string, limit = 50, offset = 0) {
    requireMobile(auth);
    const conversation = await assistantRepository.getConversation(id, auth.sub);
    if (!conversation) {
      throw Object.assign(new Error('Conversation not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    const messages = await assistantRepository.listMessages(id, limit, offset);
    return { conversation, messages };
  }

  trackEvent(
    auth: AuthClaims,
    conversationId: string | undefined,
    event: AssistantAnalyticsEvent,
  ) {
    requireMobile(auth);
    return assistantRepository.trackAnalytics(auth.sub, conversationId ?? null, event);
  }
}

export const assistantService = new AssistantService();

import { z } from 'zod';

export const AssistantMessageRoleSchema = z.enum(['user', 'assistant', 'tool']);
export type AssistantMessageRole = z.infer<typeof AssistantMessageRoleSchema>;

export const AssistantConversationStatusSchema = z.enum([
  'active',
  'archived',
  'deleted',
]);
export type AssistantConversationStatus = z.infer<
  typeof AssistantConversationStatusSchema
>;

export const NavigationPermissionSchema = z.enum(['authenticated', 'guest']);
export type NavigationPermission = z.infer<typeof NavigationPermissionSchema>;

export const NavigationCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  route: z.string(),
  paramsSchema: z.record(z.string()).optional(),
  description: z.string(),
  permissions: z.array(NavigationPermissionSchema),
  examples: z.array(z.string()),
});
export type NavigationCatalogItem = z.infer<typeof NavigationCatalogItemSchema>;

export const AssistantResultCardSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'post', 'reel', 'catalog']),
  title: z.string(),
  subtitle: z.string().optional(),
  imageUrl: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type AssistantResultCard = z.infer<typeof AssistantResultCardSchema>;

export const AssistantToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});
export type AssistantToolCall = z.infer<typeof AssistantToolCallSchema>;

export const GenieActionDomainSchema = z.enum([
  'services',
  'clips',
  'flash',
  'needs',
  'community',
  'knock',
  'shop',
]);
export type GenieActionDomain = z.infer<typeof GenieActionDomainSchema>;

export const GenieActionOutcomeSchema = z.enum([
  'success',
  'no_results',
  'canceled',
  'failed',
]);
export type GenieActionOutcome = z.infer<typeof GenieActionOutcomeSchema>;

/** Versioned structured actions — validated on server and client. */
export const GenieActionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    version: z.literal(1),
    type: z.literal('navigate'),
    target: z.object({
      route: z.string().min(1),
      params: z.record(z.unknown()).default({}),
    }),
  }),
  z.object({
    id: z.string().min(1),
    version: z.literal(1),
    type: z.literal('open_search_results'),
    domain: GenieActionDomainSchema,
    filters: z.record(z.unknown()).default({}),
  }),
  z.object({
    id: z.string().min(1),
    version: z.literal(1),
    type: z.literal('request_location'),
    purpose: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    version: z.literal(1),
    type: z.literal('confirm_mutation'),
    operation: z.string().min(1),
    preview: z.record(z.unknown()).default({}),
  }),
]);
export type GenieAction = z.infer<typeof GenieActionSchema>;

export const AssistantMessageRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  currentScreen: z.string().optional(),
  previousResponseId: z.string().optional(),
  /** Client-generated id so stale stream events can be ignored. */
  clientRequestId: z.string().uuid().optional(),
  /** Optional area label from an explicit user-typed location (never silent GPS). */
  areaLabel: z.string().max(200).optional(),
  /** Soft location hint after permissioned GPS — city/area only preferred. */
  locationHint: z
    .object({
      label: z.string().max(200).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
});
export type AssistantMessageRequest = z.infer<
  typeof AssistantMessageRequestSchema
>;

export const AssistantConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  status: AssistantConversationStatusSchema,
  personaVersion: z.string(),
  currentScreen: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type AssistantConversation = z.infer<typeof AssistantConversationSchema>;

export const AssistantMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: AssistantMessageRoleSchema,
  content: z.string().nullable(),
  toolCalls: z.array(AssistantToolCallSchema).nullable(),
  toolResults: z.array(z.record(z.unknown())).nullable(),
  createdAt: z.string(),
});
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

export const UserBehaviorEventTypeSchema = z.enum([
  'search_submitted',
  'search_result_opened',
  'provider_viewed',
  'category_viewed',
  'content_viewed',
  'content_saved',
  'item_hidden',
  'genie_action_executed',
  'filter_applied',
  'booking_intent',
  'cart_item_added',
]);
export type UserBehaviorEventType = z.infer<typeof UserBehaviorEventTypeSchema>;

export const TrackUserBehaviorEventSchema = z.object({
  type: UserBehaviorEventTypeSchema,
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});
export type TrackUserBehaviorEvent = z.infer<typeof TrackUserBehaviorEventSchema>;

export const AssistantAnalyticsEventTypeSchema = z.enum([
  'query_submitted',
  'tool_called',
  'navigation_completed',
  'result_clicked',
  'conversation_resolved',
  'unresolved_intent',
  'privacy_action',
  'provider_call',
  'action_executed',
  'action_failed',
  'stream_failed',
  'no_results',
  'guardrail_triggered',
]);
export type AssistantAnalyticsEventType = z.infer<
  typeof AssistantAnalyticsEventTypeSchema
>;

export const AssistantAnalyticsEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('query_submitted'),
    intent: z.string(),
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('tool_called'),
    toolName: z.string(),
    success: z.boolean(),
    latencyMs: z.number(),
  }),
  z.object({
    type: z.literal('navigation_completed'),
    route: z.string(),
    fromScreen: z.string().optional(),
  }),
  z.object({
    type: z.literal('result_clicked'),
    resultType: z.enum(['user', 'post', 'reel', 'catalog']),
    rank: z.number(),
  }),
  z.object({
    type: z.literal('conversation_resolved'),
    turns: z.number(),
    hadClarification: z.boolean(),
  }),
  z.object({
    type: z.literal('unresolved_intent'),
    query: z.string(),
    fallbackAction: z.string(),
  }),
  z.object({
    type: z.literal('privacy_action'),
    action: z.enum([
      'history_deleted',
      'conversation_cleared',
      'data_exported',
      'preferences_reset',
      'personalization_opt_out',
    ]),
  }),
  z.object({
    type: z.literal('provider_call'),
    provider: z.enum(['groq', 'openai']),
    model: z.string(),
    fallbackUsed: z.boolean(),
    latencyMs: z.number(),
    tokenUsage: z
      .object({
        promptTokens: z.number().optional(),
        completionTokens: z.number().optional(),
        totalTokens: z.number().optional(),
      })
      .optional(),
    failureCategory: z
      .enum([
        'timeout',
        'rate_limit',
        'server_error',
        'auth_error',
        'validation_error',
        'capability_error',
        'unknown',
      ])
      .optional(),
  }),
  z.object({
    type: z.literal('action_executed'),
    actionType: z.string(),
    actionId: z.string(),
    latencyMs: z.number().optional(),
  }),
  z.object({
    type: z.literal('action_failed'),
    actionType: z.string(),
    actionId: z.string(),
    code: z.string(),
  }),
  z.object({
    type: z.literal('stream_failed'),
    code: z.string(),
  }),
  z.object({
    type: z.literal('no_results'),
    domain: GenieActionDomainSchema.or(z.string()),
    query: z.string().optional(),
  }),
  z.object({
    type: z.literal('guardrail_triggered'),
    stage: z.enum(['input', 'output', 'tool']),
    rule: z.string(),
    action: z.enum(['blocked', 'rewritten', 'confirmation_required']),
  }),
]);
export type AssistantAnalyticsEvent = z.infer<
  typeof AssistantAnalyticsEventSchema
>;

export const TrackAssistantAnalyticsRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  event: AssistantAnalyticsEventSchema,
});
export type TrackAssistantAnalyticsRequest = z.infer<
  typeof TrackAssistantAnalyticsRequestSchema
>;

export const AssistantStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), delta: z.string() }),
  z.object({ type: z.literal('tool_start'), toolName: z.string(), message: z.string() }),
  z.object({ type: z.literal('tool_result'), toolName: z.string(), result: z.unknown() }),
  z.object({ type: z.literal('result_cards'), cards: z.array(AssistantResultCardSchema) }),
  z.object({
    type: z.literal('navigation'),
    route: z.string(),
    params: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('action'),
    action: GenieActionSchema,
  }),
  z.object({
    type: z.literal('result'),
    actionId: z.string(),
    outcome: GenieActionOutcomeSchema,
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal('quick_actions'),
    actions: z.array(z.string()),
  }),
  z.object({
    type: z.literal('done'),
    conversationId: z.string().uuid(),
    responseId: z.string().optional(),
    message: z.string(),
    clientRequestId: z.string().uuid().optional(),
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type AssistantStreamEvent = z.infer<typeof AssistantStreamEventSchema>;

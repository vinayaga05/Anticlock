import { z } from 'zod';

export const APPROVED_TOOL_NAMES = [
  'navigate_to_screen',
  'search_users',
  'search_posts',
  'search_reels',
  'get_feed',
  'get_recently_viewed',
  'get_saved_content',
  'open_content',
  'get_product_help',
  'resolve_service_category',
  'open_shop_search',
  'request_user_location',
] as const;

export type ApprovedToolName = (typeof APPROVED_TOOL_NAMES)[number];

export const MUTATING_TOOL_NAMES = new Set<ApprovedToolName>([
  'navigate_to_screen',
  'open_content',
  'resolve_service_category',
  'open_shop_search',
]);

/** Backward compatibility for stored analytics / logs */
export const LEGACY_TOOL_ALIASES: Record<string, ApprovedToolName> = {
  get_saved_posts: 'get_saved_content',
  search_catalog: 'get_product_help',
  open_result_by_index: 'open_content',
};

export const toolSchemas: Record<ApprovedToolName, z.ZodTypeAny> = {
  navigate_to_screen: z.object({
    route: z.string(),
    params: z.record(z.unknown()).default({}),
  }),
  search_users: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  search_posts: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  search_reels: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).default(3),
  }),
  get_feed: z.object({
    limit: z.number().int().min(1).max(20).default(10),
  }),
  get_recently_viewed: z.object({
    limit: z.number().int().min(1).max(20).default(10),
  }),
  get_saved_content: z.object({}),
  open_content: z.object({
    contentType: z.enum(['reel', 'user', 'post', 'catalog']),
    contentId: z.string().min(1),
    treeId: z.string().optional(),
  }),
  get_product_help: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  resolve_service_category: z.object({
    query: z.string().min(1),
    areaLabel: z.string().optional(),
    nearMe: z.boolean().default(false),
    openResults: z.boolean().default(true),
  }),
  open_shop_search: z.object({
    query: z.string().optional(),
    categoryId: z.string().optional(),
  }),
  request_user_location: z.object({
    purpose: z.string().min(1),
  }),
};

const toolDefinitions = [
  {
    name: 'navigate_to_screen' as const,
    description:
      'Navigate the user to an app screen. For Shop/Flash/Needs/Community/Knock/PlayFeed tabs use route "Main" with params { "screen": "<TabName>" }. Prefer resolve_service_category for plumbers/doctors/trainers.',
    parameters: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description:
            'React Navigation route name (e.g. Main, Search, SavedHub). Tab destinations use Main.',
        },
        params: {
          type: 'object',
          additionalProperties: true,
          description: 'Route params. For Main tabs include { "screen": "Shop" } etc.',
        },
      },
      required: ['route', 'params'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_service_category' as const,
    description:
      'Resolve a service request (plumbers, yoga, doctors, trainers) to a real catalog category and open ServiceCategory. Set nearMe=true when the user says near me / nearby.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        areaLabel: { type: 'string', description: 'Explicit city/area from the user' },
        nearMe: { type: 'boolean' },
        openResults: { type: 'boolean' },
      },
      required: ['query', 'nearMe', 'openResults'],
      additionalProperties: false,
    },
  },
  {
    name: 'open_shop_search' as const,
    description:
      'Open the Shop tab optionally filtered by a product query (e.g. home workout). Shop SKU search is on-device for now.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        categoryId: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'request_user_location' as const,
    description:
      'Ask the app to request location permission when the user wants nearby results and no area was given.',
    parameters: {
      type: 'object',
      properties: {
        purpose: { type: 'string' },
      },
      required: ['purpose'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_reels' as const,
    description: 'Search published reels/clips by topic or keyword',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_users' as const,
    description: 'Search users by display name',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_posts' as const,
    description:
      'Search posts. Flash deep search is unavailable — returns matching clips and notes the limitation.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query', 'limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_feed' as const,
    description: 'Get the latest published reels feed and open PlayFeed',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: ['limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_recently_viewed' as const,
    description: 'Get reels the user recently viewed',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: ['limit'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_saved_content' as const,
    description: 'Navigate to the user saved content hub',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'open_content' as const,
    description: 'Open a specific reel, post, user profile, or catalog category',
    parameters: {
      type: 'object',
      properties: {
        contentType: { type: 'string', enum: ['reel', 'user', 'post', 'catalog'] },
        contentId: { type: 'string' },
        treeId: { type: 'string' },
      },
      required: ['contentType', 'contentId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_product_help' as const,
    description: 'Search help topics and service catalog guidance without navigating',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query', 'limit'],
      additionalProperties: false,
    },
  },
];

export const ASSISTANT_TOOLS_CHAT = toolDefinitions.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export const ASSISTANT_TOOLS_RESPONSES = toolDefinitions.map(tool => ({
  type: 'function' as const,
  name: tool.name,
  description: tool.description,
  strict: true,
  parameters: tool.parameters,
}));

export function normalizeToolName(name: string): ApprovedToolName | null {
  if ((APPROVED_TOOL_NAMES as readonly string[]).includes(name)) {
    return name as ApprovedToolName;
  }
  return LEGACY_TOOL_ALIASES[name] ?? null;
}

export function parseToolArguments<T extends ApprovedToolName>(
  name: T,
  args: Record<string, unknown>,
) {
  return toolSchemas[name].parse(args);
}

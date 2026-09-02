import type { AssistantStreamEvent } from '@anticlock/contracts';
import type { AuthClaims } from '../lib/auth.js';
import {
  getFeed,
  getProductHelp,
  getRecentlyViewed,
  getSavedContent,
  navigateToScreen,
  openContent,
  searchPosts,
  searchReels,
  searchUsers,
  type ToolContext,
  type ToolResult,
} from './tools/index.js';
import {
  APPROVED_TOOL_NAMES,
  MUTATING_TOOL_NAMES,
  normalizeToolName,
  parseToolArguments,
  type ApprovedToolName,
} from './tools/definitions.js';

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

const TOOL_HANDLERS: Record<ApprovedToolName, ToolHandler> = {
  navigate_to_screen: (args, ctx) =>
    navigateToScreen(args as { route: string; params?: Record<string, unknown> }, ctx),
  search_reels: (args, ctx) =>
    searchReels(args as { query: string; limit?: number }, ctx),
  search_users: (args, ctx) =>
    searchUsers(args as { query: string; limit?: number }, ctx),
  search_posts: (args, ctx) =>
    searchPosts(args as { query: string; limit?: number }, ctx),
  get_feed: (args, ctx) => getFeed(args as { limit?: number }, ctx),
  get_recently_viewed: (args, ctx) =>
    getRecentlyViewed(args as { limit?: number }, ctx),
  get_saved_content: (args, ctx) => getSavedContent(args as Record<string, never>, ctx),
  open_content: (args, ctx) =>
    openContent(
      args as { contentType: 'reel' | 'user' | 'post'; contentId: string },
      ctx,
    ),
  get_product_help: (args, ctx) =>
    getProductHelp(args as { query: string; limit?: number }, ctx),
};

export { APPROVED_TOOL_NAMES, ASSISTANT_TOOLS_CHAT, ASSISTANT_TOOLS_RESPONSES } from './tools/definitions.js';

export class ToolExecutionService {
  async execute(
    name: string,
    args: Record<string, unknown>,
    auth: AuthClaims,
    conversationId: string,
    currentScreen: string | undefined,
    recentResults: ToolContext['recentResults'],
  ): Promise<{ result: ToolResult; events: AssistantStreamEvent[] }> {
    const normalized = normalizeToolName(name);
    if (!normalized || !TOOL_HANDLERS[normalized]) {
      return {
        result: { ok: false, error: `Unknown tool: ${name}`, code: 'unknown_tool' },
        events: [],
      };
    }

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = parseToolArguments(normalized, args) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid tool arguments';
      return {
        result: { ok: false, error: message, code: 'invalid_tool_args' },
        events: [],
      };
    }

    const handler = TOOL_HANDLERS[normalized];
    const ctx: ToolContext = {
      auth,
      conversationId,
      currentScreen,
      recentResults,
    };

    const started = Date.now();
    const events: AssistantStreamEvent[] = [
      {
        type: 'tool_start',
        toolName: normalized,
        message: this.progressMessage(normalized, parsedArgs),
      },
    ];

    try {
      const result = await handler(parsedArgs, ctx);
      events.push({
        type: 'tool_result',
        toolName: normalized,
        result: result.ok ? result.data : { error: result.error, code: result.code },
      });

      if (result.ok && result.cards?.length) {
        events.push({ type: 'result_cards', cards: result.cards });
        events.push({
          type: 'quick_actions',
          actions: ['Open first', 'Open second', 'Show more'],
        });
      }

      if (result.ok && result.navigation) {
        events.push({
          type: 'navigation',
          route: result.navigation.route,
          params: result.navigation.params,
        });
      }

      void started;
      return { result, events };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool execution failed';
      return {
        result: { ok: false, error: message, code: 'tool_error' },
        events: [
          ...events,
          {
            type: 'tool_result',
            toolName: normalized,
            result: { error: message, code: 'tool_error' },
          },
        ],
      };
    }
  }

  isMutatingTool(name: string) {
    const normalized = normalizeToolName(name);
    return normalized ? MUTATING_TOOL_NAMES.has(normalized) : false;
  }

  private progressMessage(name: ApprovedToolName, args: Record<string, unknown>) {
    if (name === 'search_reels') return `Searching for reels about "${String(args.query ?? '')}"...`;
    if (name === 'search_users') return `Searching for users matching "${String(args.query ?? '')}"...`;
    if (name === 'search_posts') return `Searching posts for "${String(args.query ?? '')}"...`;
    if (name === 'get_product_help') return `Finding help for "${String(args.query ?? '')}"...`;
    if (name === 'navigate_to_screen') return `Navigating to ${String(args.route ?? 'screen')}...`;
    if (name === 'get_saved_content') return 'Opening your saved content...';
    if (name === 'get_feed') return 'Loading the latest feed...';
    if (name === 'get_recently_viewed') return 'Loading recently viewed reels...';
    return `Running ${name}...`;
  }
}

export const toolExecutionService = new ToolExecutionService();

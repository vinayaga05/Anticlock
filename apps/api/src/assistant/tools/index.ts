import type { AssistantResultCard } from '@anticlock/contracts';
import type { AuthClaims } from '../../lib/auth.js';
import { validateNavigation } from '../NavigationCatalog.js';
import { searchService } from '../SearchService.js';
import { reelService } from '../../reels/ReelService.js';
import { reelEngagementRepository } from '../../reels/ReelEngagementRepository.js';

export type ToolContext = {
  auth: AuthClaims;
  conversationId: string;
  currentScreen?: string;
  recentResults: AssistantResultCard[];
};

export type ToolResult =
  | {
      ok: true;
      data: unknown;
      cards?: AssistantResultCard[];
      navigation?: { route: string; params: Record<string, unknown> };
    }
  | { ok: false; error: string; code: string };

export async function navigateToScreen(
  args: { route: string; params?: Record<string, unknown> },
  ctx: ToolContext,
): Promise<ToolResult> {
  const params = args.params ?? {};
  const isAuthenticated = ctx.auth.kind === 'mobile';
  const validation = validateNavigation(args.route, params, isAuthenticated);
  if (!validation.ok) {
    return { ok: false, error: validation.error, code: validation.code };
  }
  return {
    ok: true,
    data: { route: args.route, params },
    navigation: { route: args.route, params },
  };
}

export async function searchReels(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const cards = await searchService.searchReels(args.query, args.limit ?? 3);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return { ok: true, data: { count: cards.length }, cards };
}

export async function searchUsers(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const cards = await searchService.searchUsers(args.query, args.limit ?? 5);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return { ok: true, data: { count: cards.length }, cards };
}

export async function searchPosts(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const cards = await searchService.searchPosts(args.query, args.limit ?? 5);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return { ok: true, data: { count: cards.length }, cards };
}

export async function getFeed(
  args: { limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const feed = await reelService.listFeed();
  const cards: AssistantResultCard[] = feed.slice(0, args.limit ?? 10).map(item => ({
    id: item.id,
    type: 'reel',
    title: item.title,
    subtitle: item.caption ?? item.creatorName,
    imageUrl: item.posterUrl ?? undefined,
    metadata: { reelId: item.id },
  }));
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return { ok: true, data: { count: cards.length }, cards };
}

export async function getRecentlyViewed(
  args: { limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  if (ctx.auth.kind !== 'mobile') {
    return { ok: false, error: 'Sign in required', code: 'auth_required' };
  }
  const rows = await reelEngagementRepository.listRecentlyViewed(
    ctx.auth.sub,
    args.limit ?? 10,
  );
  const cards: AssistantResultCard[] = rows.map(row => ({
    id: row.reelId,
    type: 'reel',
    title: row.title,
    subtitle: row.caption ?? row.creatorName,
    metadata: { reelId: row.reelId },
  }));
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return { ok: true, data: { count: cards.length }, cards };
}

export async function getSavedContent(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (ctx.auth.kind !== 'mobile') {
    return { ok: false, error: 'Sign in required', code: 'auth_required' };
  }
  return {
    ok: true,
    data: { message: 'Opening saved content' },
    navigation: { route: 'SavedHub', params: {} },
  };
}

export async function getProductHelp(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const cards = await searchService.searchCatalog(args.query, args.limit ?? 5);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return {
    ok: true,
    data: {
      count: cards.length,
      topics: [
        'Use Needs to browse services',
        'Use PlayFeed for reels',
        'Saved content lives in SavedHub',
      ],
    },
    cards,
  };
}

export async function openContent(
  args: { contentType: 'reel' | 'user' | 'post'; contentId: string },
  _ctx: ToolContext,
): Promise<ToolResult> {
  if (args.contentType === 'user') {
    return {
      ok: true,
      data: args,
      navigation: { route: 'Profile', params: { userId: args.contentId } },
    };
  }
  if (args.contentType === 'reel' || args.contentType === 'post') {
    return {
      ok: true,
      data: args,
      navigation: {
        route: 'Main',
        params: { screen: 'PlayFeed', reelId: args.contentId },
      },
    };
  }
  return { ok: false, error: 'Unsupported content type', code: 'invalid_content_type' };
}

/** @deprecated use getSavedContent */
export const getSavedPosts = getSavedContent;

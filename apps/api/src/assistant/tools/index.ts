import type { AssistantResultCard, GenieAction } from '@anticlock/contracts';
import type { AuthClaims } from '../../lib/auth.js';
import { validateNavigation } from '../NavigationCatalog.js';
import {
  navigateAction,
  openSearchResultsAction,
  requestLocationAction,
} from '../genieActions.js';
import { searchService } from '../SearchService.js';
import { reelService } from '../../reels/ReelService.js';
import { reelEngagementRepository } from '../../reels/ReelEngagementRepository.js';

export type ToolContext = {
  auth: AuthClaims;
  conversationId: string;
  currentScreen?: string;
  recentResults: AssistantResultCard[];
  areaLabel?: string;
  locationHint?: { label?: string; lat?: number; lng?: number };
};

export type ToolResult =
  | {
      ok: true;
      data: unknown;
      cards?: AssistantResultCard[];
      navigation?: { route: string; params: Record<string, unknown> };
      action?: GenieAction;
      resultOutcome?: 'success' | 'no_results' | 'failed';
      resultMessage?: string;
    }
  | { ok: false; error: string; code: string };

export async function navigateToScreen(
  args: { route: string; params?: Record<string, unknown> },
  ctx: ToolContext,
): Promise<ToolResult> {
  const params = { ...(args.params ?? {}) };
  const isAuthenticated = ctx.auth.kind === 'mobile';
  const validation = validateNavigation(args.route, params, isAuthenticated);
  if (!validation.ok) {
    return { ok: false, error: validation.error, code: validation.code };
  }

  const route =
    validation.item.route === 'Main' && validation.item.paramsSchema?.screen
      ? 'Main'
      : validation.item.route;
  if (route === 'Main' && validation.item.paramsSchema?.screen) {
    params.screen = validation.item.paramsSchema.screen;
  }

  const action = navigateAction(route, params);
  return {
    ok: true,
    data: { route, params },
    navigation: { route, params },
    action,
    resultOutcome: 'success',
  };
}

export async function searchReels(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const cards = await searchService.searchReels(args.query, args.limit ?? 3);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  const action = openSearchResultsAction('clips', { q: args.query });
  return {
    ok: true,
    data: { count: cards.length },
    cards,
    action,
    resultOutcome: cards.length ? 'success' : 'no_results',
    resultMessage: cards.length
      ? undefined
      : `I couldn't find clips for "${args.query}".`,
  };
}

export async function searchUsers(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  const cards = await searchService.searchUsers(args.query, args.limit ?? 5);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return {
    ok: true,
    data: { count: cards.length },
    cards,
    resultOutcome: cards.length ? 'success' : 'no_results',
    resultMessage: cards.length
      ? undefined
      : `No users matched "${args.query}".`,
  };
}

export async function searchPosts(
  args: { query: string; limit?: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  // Flash has no public search API yet — search published reels and be honest in copy.
  const cards = await searchService.searchPosts(args.query, args.limit ?? 5);
  ctx.recentResults.splice(0, ctx.recentResults.length, ...cards);
  return {
    ok: true,
    data: {
      count: cards.length,
      note: 'Flash deep search is not available; showing matching clips instead.',
    },
    cards,
    action: openSearchResultsAction('clips', { q: args.query }),
    resultOutcome: cards.length ? 'success' : 'no_results',
  };
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
  const action = navigateAction('Main', { screen: 'PlayFeed' });
  return {
    ok: true,
    data: { count: cards.length },
    cards,
    navigation: { route: 'Main', params: { screen: 'PlayFeed' } },
    action,
    resultOutcome: cards.length ? 'success' : 'no_results',
  };
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
  return {
    ok: true,
    data: { count: cards.length },
    cards,
    resultOutcome: cards.length ? 'success' : 'no_results',
  };
}

export async function getSavedContent(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (ctx.auth.kind !== 'mobile') {
    return { ok: false, error: 'Sign in required', code: 'auth_required' };
  }
  const action = navigateAction('SavedHub', {});
  return {
    ok: true,
    data: { message: 'Opening saved content' },
    navigation: { route: 'SavedHub', params: {} },
    action,
    resultOutcome: 'success',
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
    resultOutcome: cards.length ? 'success' : 'no_results',
  };
}

export async function resolveServiceCategory(
  args: {
    query: string;
    areaLabel?: string;
    nearMe?: boolean;
    openResults?: boolean;
  },
  ctx: ToolContext,
): Promise<ToolResult> {
  if (args.nearMe && !ctx.areaLabel && !ctx.locationHint?.label && !args.areaLabel) {
    const action = requestLocationAction(
      `Find ${args.query} near your current location`,
    );
    return {
      ok: true,
      data: { needsLocation: true, query: args.query },
      action,
      resultOutcome: 'success',
      resultMessage: 'I need your location to show nearby results.',
    };
  }

  const resolved = await searchService.resolveServiceCategory(args.query);
  if (!resolved) {
    return {
      ok: true,
      data: { count: 0 },
      resultOutcome: 'no_results',
      resultMessage: `I couldn't match "${args.query}" to a service category.`,
    };
  }

  const areaLabel =
    args.areaLabel?.trim() ||
    ctx.areaLabel?.trim() ||
    ctx.locationHint?.label?.trim() ||
    undefined;

  const params: Record<string, unknown> = {
    treeId: resolved.treeId,
    categoryId: resolved.categoryId,
  };
  if (areaLabel) params.areaLabel = areaLabel;
  if (args.query) params.q = args.query;

  const open = args.openResults !== false;
  if (!open) {
    return {
      ok: true,
      data: resolved,
      cards: [
        {
          id: resolved.categoryId,
          type: 'catalog',
          title: resolved.name,
          subtitle: resolved.treeName,
          metadata: {
            treeId: resolved.treeId,
            categoryId: resolved.categoryId,
            kind: 'category',
          },
        },
      ],
      resultOutcome: 'success',
    };
  }

  const action = navigateAction('ServiceCategory', params);

  return {
    ok: true,
    data: { ...resolved, areaLabel },
    navigation: { route: 'ServiceCategory', params },
    action,
    resultOutcome: 'success',
    resultMessage: areaLabel
      ? `Opening ${resolved.name} in ${areaLabel}.`
      : `Opening ${resolved.name}.`,
  };
}

export async function openShopSearch(
  args: { query?: string; categoryId?: string },
  _ctx: ToolContext,
): Promise<ToolResult> {
  const params: Record<string, unknown> = { screen: 'Shop' };
  if (args.query) params.q = args.query;
  if (args.categoryId) params.categoryId = args.categoryId;

  const action = openSearchResultsAction('shop', {
    q: args.query,
    categoryId: args.categoryId,
  });

  return {
    ok: true,
    data: {
      note: 'Shop product search uses on-device catalog filters for now.',
      ...params,
    },
    navigation: { route: 'Main', params },
    action: navigateAction('Main', params),
    resultOutcome: 'success',
    resultMessage: args.query
      ? `I'll open Shop and look for "${args.query}".`
      : 'Opening Shop.',
  };
}

export async function requestUserLocation(
  args: { purpose: string },
  _ctx: ToolContext,
): Promise<ToolResult> {
  const action = requestLocationAction(args.purpose);
  return {
    ok: true,
    data: { purpose: args.purpose },
    action,
    resultOutcome: 'success',
  };
}

export async function openContent(
  args: { contentType: 'reel' | 'user' | 'post' | 'catalog'; contentId: string; treeId?: string },
  _ctx: ToolContext,
): Promise<ToolResult> {
  if (args.contentType === 'user') {
    const navigation = { route: 'Profile', params: { userId: args.contentId } };
    return {
      ok: true,
      data: args,
      navigation,
      action: navigateAction(navigation.route, navigation.params),
      resultOutcome: 'success',
    };
  }
  if (args.contentType === 'catalog') {
    const treeId = args.treeId ?? '';
    const navigation = {
      route: 'ServiceCategory' as const,
      params: { treeId, categoryId: args.contentId },
    };
    return {
      ok: true,
      data: args,
      navigation,
      action: navigateAction(navigation.route, navigation.params),
      resultOutcome: 'success',
    };
  }
  if (args.contentType === 'reel' || args.contentType === 'post') {
    const navigation = {
      route: 'Main',
      params: { screen: 'PlayFeed', reelId: args.contentId },
    };
    return {
      ok: true,
      data: args,
      navigation,
      action: navigateAction(navigation.route, navigation.params),
      resultOutcome: 'success',
    };
  }
  return { ok: false, error: 'Unsupported content type', code: 'invalid_content_type' };
}

/** @deprecated use getSavedContent */
export const getSavedPosts = getSavedContent;

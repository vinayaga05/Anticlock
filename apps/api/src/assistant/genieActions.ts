import { randomUUID } from 'node:crypto';
import type { GenieAction, GenieActionDomain } from '@anticlock/contracts';
import { GenieActionSchema } from '@anticlock/contracts';

export function newActionId() {
  return randomUUID();
}

export function navigateAction(
  route: string,
  params: Record<string, unknown> = {},
  id = newActionId(),
): GenieAction {
  return GenieActionSchema.parse({
    id,
    version: 1,
    type: 'navigate',
    target: { route, params },
  });
}

export function openSearchResultsAction(
  domain: GenieActionDomain,
  filters: Record<string, unknown> = {},
  id = newActionId(),
): GenieAction {
  return GenieActionSchema.parse({
    id,
    version: 1,
    type: 'open_search_results',
    domain,
    filters,
  });
}

export function requestLocationAction(
  purpose: string,
  id = newActionId(),
): GenieAction {
  return GenieActionSchema.parse({
    id,
    version: 1,
    type: 'request_location',
    purpose,
  });
}

/**
 * Preflight only. A future transactional tool must pair this with a
 * server-owned pending-operation and confirmation endpoint; this action never
 * authorizes a mutation by itself.
 */
export function confirmMutationAction(
  operation: string,
  preview: Record<string, unknown> = {},
  id = newActionId(),
): GenieAction {
  return GenieActionSchema.parse({
    id,
    version: 1,
    type: 'confirm_mutation',
    operation,
    preview,
  });
}

export function parseGenieAction(raw: unknown): GenieAction | null {
  const parsed = GenieActionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

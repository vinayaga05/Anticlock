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

export function parseGenieAction(raw: unknown): GenieAction | null {
  const parsed = GenieActionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

import { DEFAULT_LOCATION } from '@/shared/constants';

export type GenieLocationContext = {
  /** Last area the user typed (overrides device). */
  lastExplicitArea?: string;
  /** Soft label after permissioned GPS (never silently overwrites home). */
  deviceLabel?: string;
  lat?: number;
  lng?: number;
};

const AREA_HINT =
  /\b(?:in|near|around|at)\s+([A-Za-z][A-Za-z.\-\s]{1,40}?)(?:\s*[.,!?]|$)/i;
const NEAR_ME = /\b(near me|nearby|close by|around me)\b/i;
const STOP_AREA = new Set([
  'me',
  'here',
  'there',
  'you',
  'please',
  'thanks',
  'thank you',
]);

/**
 * Precedence: explicit typed area > device label > default display label.
 * Never invent coordinates for the LLM — only optional soft hints for tools.
 */
export function resolveGenieLocation(
  message: string,
  ctx: GenieLocationContext,
): {
  areaLabel?: string;
  locationHint?: { label?: string; lat?: number; lng?: number };
  wantsNearMe: boolean;
  explicitArea?: string;
} {
  const wantsNearMe = NEAR_ME.test(message);

  // When the user said "near me", do not treat "me" as an area name.
  let explicitArea: string | undefined;
  if (!wantsNearMe) {
    const match = message.match(AREA_HINT);
    explicitArea = match?.[1]?.trim();
    if (explicitArea) {
      explicitArea = explicitArea
        .replace(/\b(please|thanks|thank you)\b/gi, '')
        .trim();
      if (!explicitArea || STOP_AREA.has(explicitArea.toLowerCase())) {
        explicitArea = undefined;
      }
    }
  }

  if (explicitArea) {
    return {
      areaLabel: explicitArea,
      locationHint: { label: explicitArea },
      wantsNearMe: false,
      explicitArea,
    };
  }

  if (ctx.lastExplicitArea && !wantsNearMe) {
    return {
      areaLabel: ctx.lastExplicitArea,
      locationHint: { label: ctx.lastExplicitArea },
      wantsNearMe,
    };
  }

  if (wantsNearMe && ctx.deviceLabel) {
    return {
      areaLabel: ctx.deviceLabel,
      locationHint: {
        label: ctx.deviceLabel,
        lat: ctx.lat,
        lng: ctx.lng,
      },
      wantsNearMe: true,
    };
  }

  return {
    areaLabel: undefined,
    locationHint: ctx.deviceLabel
      ? { label: ctx.deviceLabel, lat: ctx.lat, lng: ctx.lng }
      : undefined,
    wantsNearMe,
  };
}

export function getDefaultAreaLabel() {
  return (
    [DEFAULT_LOCATION.area, DEFAULT_LOCATION.city].filter(Boolean).join(', ') ||
    'your area'
  );
}

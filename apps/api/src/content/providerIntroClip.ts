const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the onboarding introduction video id from a provider public profile. */
export function introVideoMediaIdFromPublicProfile(
  publicProfile: Record<string, unknown> | null | undefined
): string | null {
  const common = (publicProfile?.common ?? {}) as Record<string, unknown>;
  const profile = (common.profile ?? {}) as Record<string, unknown>;
  return typeof profile.introVideoMediaId === "string" &&
    UUID_RE.test(profile.introVideoMediaId)
    ? profile.introVideoMediaId
    : null;
}

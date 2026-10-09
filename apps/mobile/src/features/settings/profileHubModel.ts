import type { ProviderApplicationSummary } from '@/features/provider-onboarding/types';
import type { StatusTone } from '@/shared/publishing/ProfileTypeBadge';

/** Human status chip for a business application (never the raw enum). */
export function applicationStatusChip(
  status: string,
): { label: string; tone: StatusTone } | null {
  switch (status) {
    case 'approved':
      return { label: 'Approved', tone: 'success' };
    case 'submitted':
    case 'under_review':
      return { label: 'Under review', tone: 'info' };
    case 'more_info_requested':
      return { label: 'Action required', tone: 'warning' };
    case 'rejected':
      return { label: 'Not approved', tone: 'danger' };
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    default:
      return null;
  }
}

const PENDING_STATUSES = new Set([
  'submitted',
  'under_review',
  'more_info_requested',
]);

/** The application that created this business profile, if any. */
export function applicationForProfile(
  applications: readonly ProviderApplicationSummary[],
  profileId: string | null | undefined,
) {
  if (!profileId) return undefined;
  return applications.find(application => application.providerId === profileId);
}

/**
 * Submitted businesses that are not a selectable profile yet (no business
 * profile until approved). Shown in the switcher with their state chip.
 */
export function pendingBusinessApplications(
  applications: readonly ProviderApplicationSummary[],
  ownedProfileIds: ReadonlySet<string>,
) {
  return applications.filter(
    application =>
      PENDING_STATUSES.has(application.status) &&
      !(application.providerId && ownedProfileIds.has(application.providerId)),
  );
}

/** Share text for a public profile (personal and each business are separate). */
export function profileShareMessage(profile: {
  id: string;
  name: string;
  type: 'personal' | 'business';
}) {
  const url = `https://anticlock.online/profile?profileType=${profile.type}&profileId=${encodeURIComponent(profile.id)}`;
  return `${profile.name} on Knock\n${url}`;
}

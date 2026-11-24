import type { ProfileRelationship } from '@/shared/api/profileFollows';

export function messagingUnavailableReason(relationship?: ProfileRelationship | null): string | null {
  if (!relationship) return 'Messaging permissions are unavailable. Refresh this profile to try again.';
  if (relationship.canMessage) return null;
  if (relationship.isBlocked) return 'Messaging is unavailable for this profile.';
  if (relationship.isRequested) return 'Your follow request must be accepted before you can message.';
  if (relationship.isFollowing) return 'Messaging is turned off or unavailable for this profile.';
  return 'Follow this profile, or accept their follow request, to message.';
}

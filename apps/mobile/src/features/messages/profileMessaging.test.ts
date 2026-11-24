import { messagingUnavailableReason } from './profileMessaging';
import type { ProfileRelationship } from '@/shared/api/profileFollows';

const base: ProfileRelationship = {
  canFollow: true, followStatus: 'not_following', isFollowing: false,
  isRequested: false, isBlocked: false, canViewContent: true, canMessage: false,
};
test('explains the accepted-follow requirement', () => {
  expect(messagingUnavailableReason(base)).toContain('Follow this profile');
});
test('explains pending private follow approval', () => {
  expect(messagingUnavailableReason({ ...base, isRequested: true })).toContain('must be accepted');
});
test('does not promise access when privacy prevents an existing follower from messaging', () => {
  expect(messagingUnavailableReason({ ...base, isFollowing: true })).toContain('turned off or unavailable');
});
test('blocked profiles remain unavailable', () => {
  expect(messagingUnavailableReason({ ...base, isBlocked: true })).toBe('Messaging is unavailable for this profile.');
});
test('eligible profiles need no restriction message', () => {
  expect(messagingUnavailableReason({ ...base, canMessage: true })).toBeNull();
});

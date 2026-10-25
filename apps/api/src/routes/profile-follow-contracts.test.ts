import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CreateProfileFollowRequestSchema,
  ProfilePrivacyUpdateSchema,
} from '@anticlock/contracts';

const PERSONAL = '3ecdda28-0747-4357-aa2c-6c2e67f6e861';
const BUSINESS = '5ce8f64d-0747-4357-aa2c-6c2e67f6e862';

describe('profile follow contracts', () => {
  it('requires a profile-scoped follower and followed identity', () => {
    assert.equal(
      CreateProfileFollowRequestSchema.safeParse({
        followerProfileId: PERSONAL,
        followerProfileType: 'personal',
        followedProfileId: BUSINESS,
        followedProfileType: 'business',
      }).success,
      true,
    );
    assert.equal(
      CreateProfileFollowRequestSchema.safeParse({
        followerProfileId: PERSONAL,
        followedProfileId: BUSINESS,
      }).success,
      false,
    );
  });

  it('accepts explicit privacy controls and rejects unknown fields', () => {
    assert.deepEqual(ProfilePrivacyUpdateSchema.parse({ isPrivate: true }), { isPrivate: true });
    assert.deepEqual(ProfilePrivacyUpdateSchema.parse({ allowMessages: false }), { allowMessages: false });
    assert.equal(ProfilePrivacyUpdateSchema.safeParse({}).success, false);
    assert.equal(
      ProfilePrivacyUpdateSchema.safeParse({ isPrivate: false, unexpected: true }).success,
      false,
    );
  });
});

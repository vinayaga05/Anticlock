import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UpdateMobileProfileRequestSchema } from '@anticlock/contracts';

describe('mobile profile update contract', () => {
  it('accepts a complete, nullable profile', () => {
    const result = UpdateMobileProfileRequestSchema.safeParse({
      displayName: 'Asha Patel',
      avatarUrl: null,
      bio: 'Traveller and weekend runner.',
      location: 'Bengaluru, India',
      website: 'https://example.com',
    });

    assert.equal(result.success, true);
  });

  it('rejects invalid names and website links', () => {
    assert.equal(
      UpdateMobileProfileRequestSchema.safeParse({
        displayName: 'A',
        avatarUrl: null,
        bio: null,
        location: null,
        website: null,
      }).success,
      false,
    );
    assert.equal(
      UpdateMobileProfileRequestSchema.safeParse({
        displayName: 'Asha Patel',
        avatarUrl: null,
        bio: null,
        location: null,
        website: 'example.com',
      }).success,
      false,
    );
  });
});

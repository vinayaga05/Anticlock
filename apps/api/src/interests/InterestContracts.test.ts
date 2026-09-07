import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INTEREST_MIN_SELECTIONS,
  UpdateMyInterestsRequestSchema,
} from '@anticlock/contracts';

describe('interest selection contract', () => {
  it('requires at least the configured minimum number of unique interests', () => {
    const tooFew = UpdateMyInterestsRequestSchema.safeParse({
      interestIds: ['art', 'music'],
    });
    const duplicates = UpdateMyInterestsRequestSchema.safeParse({
      interestIds: ['art', 'music', 'music'],
    });

    assert.equal(INTEREST_MIN_SELECTIONS, 3);
    assert.equal(tooFew.success, false);
    assert.equal(duplicates.success, false);
  });

  it('accepts a valid three-interest selection', () => {
    const result = UpdateMyInterestsRequestSchema.safeParse({
      interestIds: ['art', 'music', 'travel'],
    });

    assert.equal(result.success, true);
  });
});

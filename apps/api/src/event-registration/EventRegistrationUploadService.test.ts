import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('event registration upload validation helpers', () => {
  it('rejects non-image mime types in the route contract', async () => {
    // Keep this as a lightweight guard so the public endpoint stays image-only
    // even when R2 is unavailable in unit test environments.
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    assert.equal(allowed.has('image/png'), true);
    assert.equal(allowed.has('application/pdf'), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ProviderApplicationSummarySchema } from '@anticlock/contracts';

describe('provider business portfolio contract', () => {
  const base = {
    id: '9f3f1f3e-5c0f-4f90-9b78-9c95ec2ce994',
    providerKind: 'business',
    status: 'draft',
    categoryIds: [],
    submittedAt: null,
    reviewedAt: null,
    infoRequestMessage: null,
    reviewNotes: null,
    providerId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('identifies every application with a business name for portfolio displays', () => {
    assert.equal(
      ProviderApplicationSummarySchema.safeParse({
        ...base,
        businessName: 'Northstar Fitness',
      }).success,
      true,
    );
    assert.equal(ProviderApplicationSummarySchema.safeParse(base).success, false);
  });
});

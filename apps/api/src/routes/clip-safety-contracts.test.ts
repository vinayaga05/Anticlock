import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CreateContentPostReportRequestSchema,
  CreateProfileBlockRequestSchema,
  CreateReelReportRequestSchema,
  GuidedReelReportReasonSchema,
} from '@anticlock/contracts';

describe('guided Clip safety contracts', () => {
  it('accepts every requested report category and rejects legacy-only UI input', () => {
    const requestedReasons = [
      'harmful_content',
      'bullying',
      'harassment',
      'violent_or_assault_content',
      'adult_or_pornographic_material',
      'hate_speech',
      'misinformation',
      'illegal_activity',
      'child_exploitation',
      'privacy_violation',
      'spam_or_scams',
    ];

    for (const reason of requestedReasons) {
      assert.equal(GuidedReelReportReasonSchema.safeParse(reason).success, true);
      assert.equal(CreateReelReportRequestSchema.safeParse({ reason }).success, true);
      assert.equal(CreateContentPostReportRequestSchema.safeParse({ reason }).success, true);
    }
    // Historic values remain accepted by the API for previously shipped
    // clients, but are intentionally absent from the guided mobile choices.
    assert.equal(GuidedReelReportReasonSchema.safeParse('copyright').success, false);
    assert.equal(CreateReelReportRequestSchema.safeParse({ reason: 'copyright' }).success, true);
  });

  it('accepts one precise user or business block target', () => {
    const id = '3ecdda28-0747-4357-aa2c-6c2e67f6e861';
    assert.equal(
      CreateProfileBlockRequestSchema.safeParse({ type: 'user', id }).success,
      true,
    );
    assert.equal(
      CreateProfileBlockRequestSchema.safeParse({ type: 'business', id }).success,
      true,
    );
    assert.equal(
      CreateProfileBlockRequestSchema.safeParse({
        type: 'business',
        id,
        unexpected: true,
      }).success,
      false,
    );
  });
});

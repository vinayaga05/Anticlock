import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ModerationActionRequestSchema, ModerationActionSchema } from '@anticlock/contracts';

describe('moderation API authorization', () => {
  it('validates moderation action enum', () => {
    const validActions = ['dismiss', 'remove_content', 'warn_user', 'suspend_user'];
    for (const action of validActions) {
      assert.equal(ModerationActionSchema.safeParse(action).success, true);
    }
    assert.equal(ModerationActionSchema.safeParse('invalid_action').success, false);
  });

  it('requires note for moderation action', () => {
    assert.equal(
      ModerationActionRequestSchema.safeParse({
        action: 'dismiss',
        note: 'Valid reason',
      }).success,
      true
    );

    assert.equal(
      ModerationActionRequestSchema.safeParse({
        action: 'dismiss',
        note: '',
      }).success,
      false
    );

    assert.equal(
      ModerationActionRequestSchema.safeParse({
        action: 'dismiss',
      }).success,
      false
    );
  });

  it('enforces note length limits', () => {
    const longNote = 'a'.repeat(1001);
    assert.equal(
      ModerationActionRequestSchema.safeParse({
        action: 'dismiss',
        note: longNote,
      }).success,
      false
    );

    const validNote = 'a'.repeat(500);
    assert.equal(
      ModerationActionRequestSchema.safeParse({
        action: 'dismiss',
        note: validNote,
      }).success,
      true
    );
  });

  it('trims whitespace from note', () => {
    const result = ModerationActionRequestSchema.parse({
      action: 'dismiss',
      note: '  Valid reason  ',
    });
    assert.equal(result.note, 'Valid reason');
  });
});

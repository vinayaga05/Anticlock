import { needsDisplayName } from './needsDisplayName';

describe('needsDisplayName', () => {
  it('asks for a name on placeholders and skips real names', () => {
    expect(needsDisplayName(null)).toBe(false);
    expect(needsDisplayName({ id: 'temporary-guest', displayName: 'Guest' })).toBe(
      false,
    );
    expect(needsDisplayName({ id: 'u1', displayName: 'User 4321' })).toBe(true);
    expect(needsDisplayName({ id: 'u1', displayName: 'Guest' })).toBe(true);
    expect(needsDisplayName({ id: 'u1', displayName: '  ' })).toBe(true);
    expect(needsDisplayName({ id: 'u1', displayName: 'A' })).toBe(true);
    expect(needsDisplayName({ id: 'u1', displayName: 'Asha Patel' })).toBe(false);
  });
});

import { normalizeProfileWebsite, profileDraft, profileInitials, storedProfilePhoto, validateProfileDraft } from './profileForm';
const draft = { displayName: '  Arun Kumar  ', bio: '  Runner and explorer.  ', location: '  Chennai  ', website: 'example.com/about' };
test('normalizes optional website schemes and trims profile fields', () => {
  expect(validateProfileDraft(draft)).toEqual({ displayName: 'Arun Kumar', bio: 'Runner and explorer.', location: 'Chennai', website: 'https://example.com/about' });
  expect(normalizeProfileWebsite(' http://example.com/a ')).toBe('http://example.com/a');
  expect(normalizeProfileWebsite('//example.com')).toBe('https://example.com/');
  expect(validateProfileDraft({ ...draft, bio: ' ', location: ' ', website: ' ' })).toEqual({ displayName: 'Arun Kumar', bio: null, location: null, website: null });
});
test.each(['javascript:alert(1)', 'file:///photo.jpg', 'ftp://example.com', 'https://user:password@example.com', 'https://user@example.com', 'https://', 'not a website', 'https:example.com'])('rejects unsupported, malformed or credential-bearing website %s', value => { expect(() => normalizeProfileWebsite(value)).toThrow(); });
test('enforces name, biography, city and normalized URL limits', () => {
  for (const value of [{ ...draft, displayName: 'A' }, { ...draft, displayName: 'x'.repeat(81) }, { ...draft, bio: 'x'.repeat(161) }, { ...draft, location: 'x'.repeat(81) }, { ...draft, website: `example.com/${'x'.repeat(2000)}` }]) expect(() => validateProfileDraft(value)).toThrow();
  expect(() => validateProfileDraft({ ...draft, displayName: 'x'.repeat(80), bio: 'x'.repeat(160), location: 'x'.repeat(80) })).not.toThrow();
});
test('uses local initials and recognizes generated fallback avatars without inventing a photo', () => {
  expect(profileInitials(' Arun   Kumar ')).toBe('AK'); expect(profileInitials('  ')).toBe('You');
  expect(storedProfilePhoto('data:image/svg+xml;utf8,generated')).toBeNull(); expect(storedProfilePhoto('https://images.example.test/avatar.jpg')).toBe('https://images.example.test/avatar.jpg');
  expect(profileDraft(null)).toEqual({ displayName: '', bio: '', location: '', website: '' });
});


test.each(['file:///private/photo.jpg', 'content://photos/1', 'data:image/png;base64,AA==', 'https://user:password@example.com/photo.jpg', 'https:example.com/photo.jpg', 'not-a-url'])('ignores unsupported legacy avatar %s instead of sending it back on a text save', value => {
  expect(storedProfilePhoto(value)).toBeNull();
});

import { validateComplaintDraft } from './complaintForm';

test('trims both fields and enforces title/description limits', () => {
  expect(validateComplaintDraft('  Entrance light  ', '  The entrance light does not work.  ')).toEqual({ title: 'Entrance light', description: 'The entrance light does not work.' });
  for (const [title, description] of [['  a ', 'A complete description'], ['title', ' short '], ['a'.repeat(121), 'A complete description'], ['title', 'a'.repeat(3001)]]) {
    expect(() => validateComplaintDraft(title, description)).toThrow();
  }
});

test('Unicode minima count code points so short emoji inputs cannot pass locally and fail server validation', () => {
  expect(() => validateComplaintDraft('🏟️', 'A complete description')).toThrow();
  expect(() => validateComplaintDraft('😀😀', 'A complete description')).toThrow();
  expect(() => validateComplaintDraft('Valid title', '😀'.repeat(5))).toThrow();
  expect(validateComplaintDraft('😀'.repeat(3), '😀'.repeat(10))).toEqual({ title: '😀'.repeat(3), description: '😀'.repeat(10) });
});

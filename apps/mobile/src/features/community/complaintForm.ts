import type { CreateComplaintRequest } from '@anticlock/contracts';

export function validateComplaintDraft(title: string, description: string): Pick<CreateComplaintRequest, 'title' | 'description'> {
  const value = { title: title.trim(), description: description.trim() };
  if ([...value.title].length < 3 || value.title.length > 120) {
    throw new Error('Enter a title between 3 and 120 characters.');
  }
  if ([...value.description].length < 10 || value.description.length > 3000) {
    throw new Error('Describe your complaint in 10 to 3,000 characters.');
  }
  return value;
}

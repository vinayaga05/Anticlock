import type { MobileUser, ProfileUpdate } from '@/shared/services/auth/types';

export type ProfileDraft = { displayName: string; bio: string; location: string; website: string };

export function profileDraft(user: MobileUser | null): ProfileDraft {
  return { displayName: user?.displayName ?? '', bio: user?.bio ?? '', location: user?.location ?? '', website: user?.website ?? '' };
}

export function storedProfilePhoto(avatarUrl?: string | null): string | null {
  if (!avatarUrl || !/^https?:\/\//i.test(avatarUrl)) return null;
  try {
    const url = new URL(avatarUrl);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function profileInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => [...word][0]).join('').toLocaleUpperCase() || 'You';
}

export function normalizeProfileWebsite(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const message = 'Enter a valid website, such as yourwebsite.com.';
  if (/\s/.test(value) || (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))) throw new Error(message);
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : value.startsWith('//') ? `https:${value}` : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error(message);
    if (url.href.length > 2000) throw new Error('Keep your website under 2,000 characters.');
    return url.href;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Keep your website')) throw error;
    throw new Error(message);
  }
}

export function validateProfileDraft(draft: ProfileDraft): Omit<ProfileUpdate, 'avatarUrl'> {
  const displayName = draft.displayName.trim();
  const bio = draft.bio.trim();
  const location = draft.location.trim();
  if (displayName.length < 2 || displayName.length > 80) throw new Error('Enter a name between 2 and 80 characters.');
  if (bio.length > 160) throw new Error('Keep your bio under 160 characters.');
  if (location.length > 80) throw new Error('Keep your city or location under 80 characters.');
  return { displayName, bio: bio || null, location: location || null, website: normalizeProfileWebsite(draft.website) };
}

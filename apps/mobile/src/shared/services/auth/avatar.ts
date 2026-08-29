import type { MobileUser } from './types';

const AVATAR_COLORS = ['#0F766E', '#2563EB', '#7C3AED', '#DB2777', '#C2410C'];

function colorFor(seed: string): string {
  let hash = 7;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 2147483647;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialFor(name: string): string {
  const initial = name.trim().charAt(0).toUpperCase();
  return /^[A-Z0-9]$/.test(initial) ? initial : 'U';
}

/** Creates a compact, local avatar image for accounts that have not uploaded a photo yet. */
export function createAvatarDataUri(user: Pick<MobileUser, 'id' | 'displayName'>): string {
  const color = colorFor(user.id);
  const initial = initialFor(user.displayName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${color}"/><circle cx="76" cy="21" r="19" fill="white" fill-opacity=".15"/><text x="48" y="59" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="43" font-weight="700">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function ensureUserAvatar(user: MobileUser, storedAvatarUrl?: string | null): MobileUser {
  if (user.avatarUrl) return user;
  return {
    ...user,
    avatarUrl: storedAvatarUrl ?? createAvatarDataUri(user),
  };
}

/** Public link that opens one clip in the app (see navigation/linking.ts). */
export const CLIP_SHARE_ORIGIN = 'https://anticlock.online';

export function clipShareUrl(id: string) {
  return `${CLIP_SHARE_ORIGIN}/reels/${encodeURIComponent(id)}`;
}

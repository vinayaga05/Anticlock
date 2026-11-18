import type { StoryAudience } from '@/shared/data/flash/storyTypes';

export type StoryStyle = {
  backgroundColor: string;
  textColor: string;
  textX: number;
  textY: number;
  textScale: number;
  sticker?: string;
};

export const DEFAULT_STORY_STYLE: StoryStyle = {
  backgroundColor: '#6741d9',
  textColor: '#ffffff',
  textX: 0.5,
  textY: 0.35,
  textScale: 1,
};
export const STORY_COLORS = [
  '#6741d9',
  '#063eea',
  '#e62683',
  '#087f8c',
  '#171923',
  '#ec7848',
];
export const STORY_STICKERS = ['✨', '❤️', '🌅', '🎉', '📍', '☀️', '💪', '😍'];

export function storyPublishFailure(
  error: unknown,
  publishedCount: number,
): string {
  const prefix = publishedCount
    ? `${publishedCount} moment${publishedCount === 1 ? '' : 's'} shared. `
    : '';
  const request = error as { status?: unknown; code?: unknown } | null;
  if (request?.status === 400 && request.code === 'validation_error') {
    return `${prefix}The story service rejected this story. Your remaining moments are kept here. Please check that the story service is up to date before sharing again.`;
  }
  return `${prefix}${
    error instanceof Error ? error.message : 'Could not share your story.'
  } Your remaining moments are ready to retry.`;
}
export const STORY_AUDIENCES: {
  id: Exclude<StoryAudience, 'selected'>;
  label: string;
  visibility: 'public' | 'followers' | 'friends';
}[] = [
  { id: 'public', label: 'Public', visibility: 'public' },
  { id: 'followers', label: 'Followers', visibility: 'followers' },
];

/** Count only server-acknowledged segments; retry starts with the first unacknowledged one. */
export async function publishStorySequence<T>(
  items: readonly T[],
  publish: (item: T) => Promise<unknown>,
  onPublished: (item: T) => void,
): Promise<void> {
  for (const item of items) {
    await publish(item);
    onPublished(item);
  }
}

export function movedStoryText(
  x: number,
  y: number,
  dx: number,
  dy: number,
  width: number,
  height: number,
) {
  return {
    textX: Math.max(0.1, Math.min(0.9, x + dx / Math.max(width, 1))),
    textY: Math.max(0.08, Math.min(0.8, y + dy / Math.max(height, 1))),
  };
}

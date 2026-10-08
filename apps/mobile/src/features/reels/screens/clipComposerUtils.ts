export function normalizeHashtags(input: string): string[] {
  const values = input
    .split(/[\s,]+/)
    .map(value => value.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);

  const invalid = values.find(
    value => !/^[a-z0-9][a-z0-9_]{0,49}$/.test(value),
  );
  if (invalid) {
    throw new Error(
      `#${invalid} is not a valid hashtag. Use letters, numbers, and underscores.`,
    );
  }

  return [...new Set(values)].slice(0, 30);
}

export function normalizeTaggedUserIds(input: string): string[] {
  const values = input
    .split(/[\s,]+/)
    .map(value => value.trim())
    .filter(Boolean);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalid = values.find(value => !uuid.test(value));
  if (invalid) {
    throw new Error('Tags must use valid user IDs, separated by commas.');
  }
  return [...new Set(values)].slice(0, 20);
}

export function displayBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Overall progress for the publish card: the video transfer is the long
 * part (10–75%), the cover is short (75–88%), publishing finishes it.
 */
export function uploadProgressPercent(
  phase: 'preparing' | 'video' | 'cover' | 'publishing' | 'complete',
  fraction = 0,
): number {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  switch (phase) {
    case 'preparing':
      return 5;
    case 'video':
      return Math.round(10 + f * 65);
    case 'cover':
      return Math.round(75 + f * 13);
    case 'publishing':
      return 92;
    case 'complete':
      return 100;
  }
}

/** Cancelling is only possible before the publish request is sent. */
export function canCancelUpload(phase: string): boolean {
  return phase === 'preparing' || phase === 'video' || phase === 'cover';
}

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

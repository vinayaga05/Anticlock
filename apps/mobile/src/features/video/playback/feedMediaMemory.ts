export type FeedMediaState = {
  muted: boolean;
  paused: boolean;
  position: number;
};
const defaults: FeedMediaState = { muted: false, paused: false, position: 0 };

/** Session-only, bounded state survives cell recycling without retaining native players. */
export function createFeedMediaMemory(limit = 200) {
  const entries = new Map<string, FeedMediaState>();
  return {
    get(key: string): FeedMediaState {
      return entries.get(key) ?? defaults;
    },
    update(key: string, patch: Partial<FeedMediaState>) {
      const value = { ...(entries.get(key) ?? defaults), ...patch };
      value.position = Number.isFinite(value.position)
        ? Math.max(0, value.position)
        : 0;
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > limit) entries.delete(entries.keys().next().value!);
    },
    clear() {
      entries.clear();
    },
  };
}
export const feedMediaMemory = createFeedMediaMemory();

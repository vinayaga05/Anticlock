/**
 * Set to the API origin to enable live catalog / reels queries.
 * Leave empty to keep mocks as fallback.
 *
 * Example: 'http://localhost:4000' (iOS sim) or 'http://10.0.2.2:4000' (Android emulator)
 */
export const API_BASE_URL = '';

export const isApiEnabled = Boolean(API_BASE_URL);

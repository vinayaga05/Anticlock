/** Public syntax shared by all username entry points; reserved names are server-owned. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function usernameProblem(value: string): string | null {
  const name = normalizeUsername(value);
  if (!/^[a-z0-9._]{3,30}$/.test(name)) return 'Use 3–30 letters, numbers, periods or underscores.';
  if (!/[a-z0-9]/.test(name)) return 'Include at least one letter or number.';
  if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) return 'Periods cannot be first, last or consecutive.';
  return null;
}

export type UsernameAvailability = {
  username: string;
  status: 'available' | 'taken' | 'invalid';
  message?: string;
  suggestions: string[];
};

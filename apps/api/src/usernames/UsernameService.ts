import { and, eq, ne } from 'drizzle-orm';
import { normalizeUsername, usernameProblem, type UsernameAvailability } from '@anticlock/contracts/username';
import { db } from '../db/client.js';
import { mobileUsers } from '../db/schema.js';
import { ApiError } from '../lib/httpError.js';

// Extend through server configuration; never trust a client-side reserved list.
const reserved = () => new Set(['admin', 'administrator', 'support', 'knock', 'anticlock', 'help', 'security', 'moderator', 'system', 'official', ...(process.env.RESERVED_USERNAMES ?? '').split(',')].map(normalizeUsername));
export function assertUsername(value: string) {
  const name = normalizeUsername(value);
  const problem = usernameProblem(value);
  if (problem) throw new ApiError(400, 'USERNAME_INVALID', problem);
  if (reserved().has(name)) throw new ApiError(400, 'USERNAME_RESERVED', 'This username is reserved. Choose another.');
  return name;
}

export async function usernameAvailable(name: string, userId: string) {
  const [owner] = await db.select({ id: mobileUsers.id }).from(mobileUsers)
    .where(and(eq(mobileUsers.handle, name), ne(mobileUsers.id, userId))).limit(1);
  return !owner;
}

export async function checkUsername(value: string, userId: string): Promise<UsernameAvailability> {
  const username = normalizeUsername(value);
  try { assertUsername(value); }
  catch (error) { return { username, status: 'invalid', message: (error as Error).message, suggestions: [] }; }
  if (await usernameAvailable(username, userId)) return { username, status: 'available', suggestions: [] };
  // Suggestions depend only on the entered handle, never on authentication/phone data.
  const base = username.slice(0, 25).replace(/\.+$/, '');
  const suggestions: string[] = [];
  for (let index = 1; index <= 24 && suggestions.length < 3; index++) {
    const candidate = `${base}_${index}`;
    if (!reserved().has(candidate) && await usernameAvailable(candidate, userId)) suggestions.push(candidate);
  }
  return { username, status: 'taken', message: 'This username is already taken.', suggestions };
}

export async function claimUsername(userId: string, value: string) {
  const handle = assertUsername(value);
  try {
    // A unique database index arbitrates concurrent claims, including case variants.
    const [user] = await db.update(mobileUsers).set({ handle, updatedAt: new Date() })
      .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true))).returning();
    if (!user) throw new ApiError(404, 'not_found', 'Account not found.');
    return user;
  } catch (error: any) {
    if (error?.code === '23505' || error?.cause?.code === '23505') throw new ApiError(409, 'USERNAME_TAKEN', 'This username is already taken.');
    throw error;
  }
}

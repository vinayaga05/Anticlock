import { createHash, randomUUID } from 'node:crypto';
import { sql } from '../db/client.js';
import type { OtpContext } from './otp/types.js';

const hash = (value: string | undefined) => value ? createHash('sha256').update(`${process.env.OTP_HASH_SECRET ?? 'local-session'}:${value}`).digest('hex') : null;
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function createMobileSession(userId: string, context: OtpContext & { expiresAt?: Date } = {}): Promise<{ id: string; expiresAt: string }> {
  const id = randomUUID(); const expiresAt = context.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const rows = await sql`INSERT INTO mobile_auth_sessions(id, user_id, device_hash, ip_hash, expires_at)
    SELECT ${id}, id, ${hash(context.deviceId)}, ${hash(context.ip)}, ${expiresAt.toISOString()} FROM mobile_users WHERE id = ${userId} AND is_active = true RETURNING id`;
  if (!rows.length) throw new Error('Active mobile account required');
  return { id, expiresAt: expiresAt.toISOString() };
}
export async function isMobileSessionActive(userId: string, sid: string): Promise<boolean> {
  if (!uuid(userId) || !uuid(sid)) return false;
  const rows = await sql`SELECT s.id FROM mobile_auth_sessions s JOIN mobile_users u ON u.id = s.user_id
    WHERE s.id = ${sid} AND s.user_id = ${userId} AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active = true LIMIT 1`;
  return rows.length === 1;
}
export async function revokeMobileSession(userId: string, sid: string): Promise<void> {
  if (!uuid(userId) || !uuid(sid)) return;
  await sql`UPDATE mobile_auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = ${sid} AND user_id = ${userId}`;
}
export async function revokeAllMobileSessions(userId: string): Promise<void> {
  if (!uuid(userId)) return;
  await sql`UPDATE mobile_auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = ${userId} AND revoked_at IS NULL`;
}

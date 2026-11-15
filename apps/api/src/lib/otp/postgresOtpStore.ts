import { timingSafeEqual } from 'node:crypto';
import { sql } from '../../db/client.js';

export type StoredOtpError = { code: string; message: string; retryAfterSeconds?: number };
export type OtpLimit = { id: string; scope: 'phone' | 'shared'; limit: number; resetAt: number };
export type ReserveOtp = {
  id: string; phoneHash: string; codeHash: string; deviceHash: string | null;
  now: number; expiresAt: number; limits: OtpLimit[];
};
export type VerifyOtp = { id: string; phoneHash: string; codeHash: string; deviceHash: string | null; now: number; limits: OtpLimit[] };
export type OtpStore = {
  reserve(input: ReserveOtp): Promise<StoredOtpError | null>;
  activate(id: string, phoneHash: string): Promise<boolean>;
  fail(id: string, phoneHash: string): Promise<void>;
  verify(input: VerifyOtp): Promise<{ valid: boolean; error?: StoredOtpError }>;
};

const at = (value: number) => new Date(value).toISOString();
const retry = (until: Date | string, now: number) => Math.max(1, Math.ceil((new Date(until).getTime() - now) / 1000));
const locked = (until: Date | string, now: number): StoredOtpError => ({ code: 'otp_locked', message: 'Too many incorrect codes. Please try again later.', retryAfterSeconds: retry(until, now) });

export class PostgresOtpStore implements OtpStore {
  private async consumeLimits(tx: any, limits: OtpLimit[], now: number): Promise<StoredOtpError | null> {
    for (const limit of [...limits].sort((a, b) => a.id.localeCompare(b.id))) {
      const rows = await tx`
        INSERT INTO otp_rate_limits (id, count, reset_at) VALUES (${limit.id}, 1, ${at(limit.resetAt)})
        ON CONFLICT(id) DO UPDATE SET
          count = CASE WHEN otp_rate_limits.reset_at <= ${at(now)} THEN 1 ELSE otp_rate_limits.count + 1 END,
          reset_at = CASE WHEN otp_rate_limits.reset_at <= ${at(now)} THEN EXCLUDED.reset_at ELSE otp_rate_limits.reset_at END
        WHERE otp_rate_limits.reset_at <= ${at(now)} OR otp_rate_limits.count < ${limit.limit}
        RETURNING id
      `;
      if (!rows.length) return { code: 'rate_limit_exceeded', message: 'Too many requests. Please try again later.', retryAfterSeconds: Math.max(1, Math.ceil((limit.resetAt - now) / 1000)) };
    }
    return null;
  }

  async reserve(input: ReserveOtp): Promise<StoredOtpError | null> {
    const result = await sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'otp:' + input.phoneHash}, 0))`;
      const sharedError = await this.consumeLimits(tx, input.limits.filter(l => l.scope === 'shared'), input.now);
      if (sharedError) return sharedError;
      await tx`INSERT INTO otp_phone_states(phone_hash, updated_at) VALUES (${input.phoneHash}, ${at(input.now)}) ON CONFLICT DO NOTHING`;
      const [state] = await tx`SELECT * FROM otp_phone_states WHERE phone_hash = ${input.phoneHash} FOR UPDATE`;
      if (state.locked_until && new Date(state.locked_until).getTime() > input.now) return locked(state.locked_until, input.now);
      if (state.last_sent_at && new Date(state.last_sent_at).getTime() + 60_000 > input.now) return {
        code: 'resend_cooldown', message: 'Please wait before requesting another code.',
        retryAfterSeconds: retry(new Date(new Date(state.last_sent_at).getTime() + 60_000), input.now),
      };
      const error = await this.consumeLimits(tx, input.limits.filter(l => l.scope === 'phone'), input.now);
      if (error) return error;
      await tx`UPDATE otp_challenges SET status = 'superseded' WHERE phone_hash = ${input.phoneHash} AND status IN ('pending', 'sent')`;
      await tx`INSERT INTO otp_challenges(id, phone_hash, code_hash, device_hash, status, expires_at, created_at)
        VALUES (${input.id}, ${input.phoneHash}, ${input.codeHash}, ${input.deviceHash}, 'pending', ${at(input.expiresAt)}, ${at(input.now)})`;
      await tx`UPDATE otp_phone_states SET active_request_id = ${input.id}, last_sent_at = ${at(input.now)}, updated_at = ${at(input.now)},
        failed_attempts = CASE WHEN locked_until IS NOT NULL AND locked_until <= ${at(input.now)} THEN 0 ELSE failed_attempts END,
        locked_until = CASE WHEN locked_until <= ${at(input.now)} THEN NULL ELSE locked_until END
        WHERE phone_hash = ${input.phoneHash}`;
      return null;
    });
    if (!result) await this.cleanup(input.now);
    return result;
  }

  async activate(id: string, phoneHash: string): Promise<boolean> {
    return sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'otp:' + phoneHash}, 0))`;
      const result = await tx`UPDATE otp_challenges SET status = 'sent' WHERE id = ${id} AND phone_hash = ${phoneHash}
        AND status = 'pending' AND EXISTS(SELECT 1 FROM otp_phone_states WHERE phone_hash = ${phoneHash} AND active_request_id = ${id}) RETURNING id`;
      return result.length === 1;
    });
  }

  async fail(id: string, phoneHash: string): Promise<void> {
    await sql`UPDATE otp_challenges SET status = 'failed' WHERE id = ${id} AND phone_hash = ${phoneHash} AND status = 'pending'`;
  }

  async verify(input: VerifyOtp): Promise<{ valid: boolean; error?: StoredOtpError }> {
    return sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'otp:' + input.phoneHash}, 0))`;
      const sharedError = await this.consumeLimits(tx, input.limits.filter(l => l.scope === 'shared'), input.now);
      if (sharedError) return { valid: false, error: sharedError };
      await tx`INSERT INTO otp_phone_states(phone_hash, updated_at) VALUES (${input.phoneHash}, ${at(input.now)}) ON CONFLICT DO NOTHING`;
      const [state] = await tx`SELECT * FROM otp_phone_states WHERE phone_hash = ${input.phoneHash} FOR UPDATE`;
      if (state.locked_until && new Date(state.locked_until).getTime() > input.now) return { valid: false, error: locked(state.locked_until, input.now) };
      const error = await this.consumeLimits(tx, input.limits.filter(l => l.scope === 'phone'), input.now);
      if (error) return { valid: false, error };
      const [challenge] = await tx`SELECT * FROM otp_challenges WHERE id = ${input.id} AND phone_hash = ${input.phoneHash}`;
      if (challenge && challenge.status === 'sent' && new Date(challenge.expires_at).getTime() <= input.now) {
        await tx`UPDATE otp_challenges SET status = 'expired' WHERE id = ${input.id}`;
        return { valid: false, error: { code: 'otp_expired', message: 'This code has expired. Request a new code.' } };
      }
      const hashMatches = challenge && challenge.code_hash.length === input.codeHash.length
        && timingSafeEqual(Buffer.from(challenge.code_hash, 'hex'), Buffer.from(input.codeHash, 'hex'));
      if (challenge && String(state.active_request_id) === input.id && challenge.status === 'sent'
        && (!challenge.device_hash || challenge.device_hash === input.deviceHash) && hashMatches) {
        await tx`UPDATE otp_challenges SET status = 'used' WHERE id = ${input.id}`;
        await tx`UPDATE otp_phone_states SET failed_attempts = 0, locked_until = NULL, updated_at = ${at(input.now)} WHERE phone_hash = ${input.phoneHash}`;
        return { valid: true };
      }
      const previous = state.locked_until && new Date(state.locked_until).getTime() <= input.now ? 0 : state.failed_attempts;
      const attempts = previous + 1;
      const until = attempts >= 5 ? new Date(input.now + 15 * 60_000) : null;
      await tx`UPDATE otp_phone_states SET failed_attempts = ${attempts}, locked_until = ${until?.toISOString() ?? null}, updated_at = ${at(input.now)} WHERE phone_hash = ${input.phoneHash}`;
      if (until) {
        await tx`UPDATE otp_challenges SET status = 'failed' WHERE phone_hash = ${input.phoneHash} AND status IN ('pending', 'sent')`;
        return { valid: false, error: locked(until, input.now) };
      }
      return { valid: false };
    });
  }

  private async cleanup(now: number): Promise<void> {
    // Cleanup runs outside the per-phone transaction. SKIP LOCKED keeps it from
    // blocking another phone's challenge creation or verification.
    await sql`DELETE FROM otp_challenges WHERE id IN (SELECT id FROM otp_challenges WHERE expires_at < ${at(now - 86_400_000)} LIMIT 200 FOR UPDATE SKIP LOCKED)`;
    await sql`DELETE FROM otp_rate_limits WHERE id IN (SELECT id FROM otp_rate_limits WHERE reset_at < ${at(now - 86_400_000)} LIMIT 200 FOR UPDATE SKIP LOCKED)`;
    await sql`DELETE FROM otp_phone_states WHERE phone_hash IN (SELECT phone_hash FROM otp_phone_states
      WHERE updated_at < ${at(now - 30 * 86_400_000)} AND (locked_until IS NULL OR locked_until <= ${at(now)}) LIMIT 200 FOR UPDATE SKIP LOCKED)`;
  }
}

-- Schema only. Pending OTP accounts may have NULL handles; a non-NULL handle
-- is the authoritative completed username setup state. No account backfill/reset.
ALTER TABLE mobile_users ADD COLUMN IF NOT EXISTS handle text;
CREATE UNIQUE INDEX IF NOT EXISTS mobile_users_username_canonical_unique ON mobile_users (lower(handle));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobile_users_username_policy' AND conrelid = 'mobile_users'::regclass) THEN
    ALTER TABLE mobile_users ADD CONSTRAINT mobile_users_username_policy CHECK (
      handle IS NULL OR (
        handle = lower(handle) AND handle ~ '^[a-z0-9._]{3,30}$'
        AND handle ~ '[a-z0-9]' AND handle !~ '^\.|\.$|\.\.'
      )
    );
  END IF;
END $$;

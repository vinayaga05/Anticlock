# Knock usernames

An OTP-authenticated account with `mobile_users.handle IS NULL` is incomplete.
Only session inspection, username setup, logout and account closure are allowed
until a canonical handle is saved. The mobile navigator shows username setup
before display-name/interests onboarding, keeps deep links pending, and waits to
connect notifications, content streams and chat until username setup completes.
Guests remain temporary, unauthenticated previews.

`packages/contracts/src/username.ts` owns normalization and syntax. The API owns
reserved names (`RESERVED_USERNAMES` extends the built-in list). A CHECK constraint
requires canonical lowercase syntax for every non-null handle; the unique index
on `lower(handle)` arbitrates concurrent claims. No placeholder usernames,
phone-derived suggestions, backfills or account deletion are part of this change.

## Endpoints

- `GET /auth/mobile/username/availability?username=...`: authenticated, returns
  canonical username, available/taken/invalid status and up to three alternatives.
- `PUT /auth/mobile/username`, `{ "username": "arun.fit" }`: atomic initial claim
  or rename. Returns the updated user. Conflicts return `409 USERNAME_TAKEN`.
  Repeating the same successful claim for the owner succeeds.
- `GET /auth/mobile/me`: returns `handle` and derived `needsUsername` so restarts
  restore unfinished setup. The client also uses this to recover lost save responses.
- `GET /auth/mobile/users?q=@ARUN.FIT`: safe public profile cards, exact username
  first, then prefix, then display-name matches. `exact=true` performs normalized
  exact lookup. Inactive, incomplete and mutually blocked accounts are excluded.
- `PUT /auth/mobile/profile`: uses the same username validation and uniqueness.
  A completed account cannot clear its username.

Private content continues through the existing profile/content permission gates.
Follows, content authors, tags, chat channel IDs and profile share URLs use immutable
user/profile IDs. Existing tagged-user metadata already stores IDs; free-text
`@mention` parsing is not an existing supported feature. Renames release the old
handle. Query caches refresh locally and through the existing social refresh event.
Stream user metadata is updated after commit and repaired at the next connection
if the provider is unavailable.

## Migration

Use the reset dataset chosen for the release. Do not run an account reset as part
of this migration. Run from `apps/api` with that database in `DATABASE_URL`:

```sh
pnpm db:migrate:usernames
```

This dedicated command executes only `src/db/migrations/username.sql` inside a
transaction. It is idempotent and contains DDL only. The normal migration runner
also includes this schema step, but its pre-existing seed/data operations remain;
use the dedicated command when only the username schema is wanted. Existing
noncanonical handles cause migration failure rather than silent data rewriting.

The migration was applied to the disposable local database
`knock_username_test` on `127.0.0.1:55439` in Docker container
`knock-usernames-test-20261126`. Production was not migrated or deployed.

## Verification

PostgreSQL tests exercise OTP-created incomplete accounts, recovery, simultaneous
case variants, database constraints, conflicts, suggestions, private headers,
bidirectional blocks and rename continuity. Mobile tests exercise both iOS and
Android signup rendering, stale checks, offline/timeouts, suggestions, duplicate
saves and recovery after a lost response. Related profile, messaging and social
tests cover the existing ID-based relationships.

Current checks: 80 mobile tests and 54 API/regression tests passed. Production
JavaScript bundles completed for iOS and Android. Contracts and API builds passed.
The full mobile typecheck reports the same 23 pre-existing diagnostics as the
earlier workspace check, with no new diagnostics from this change.

Before shipping, run real-device OTP signup/restart/deep-link and rename scenarios
against the release backend on iOS and Android, including live Stream reconnect
and remote username updates. Jest platform rendering and Metro bundles do not
constitute those device/provider checks. Rebuild the mobile release after this
change; the earlier uploaded Play bundle does not contain it.

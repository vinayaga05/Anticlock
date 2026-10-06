# DB-backed integration tests (not run in CI)

These tests are written for **vitest** and need a live Postgres (they insert/delete
rows through `db/client.ts`). They are kept out of `pnpm test`, which runs the
`node:test` unit suite via `tsx --test src/routes/*.test.ts` (non-recursive) and
must pass in CI without a database.

Known gaps before these can be wired into CI:

- `vitest` is not a dependency of `@anticlock/api`.
- `communities.test.ts` imports `src/test-helpers.ts` (`testRequest`,
  `createTestUser`, `createMobileTestUser`) and calls `getMobileToken`, none of
  which exist yet.
- A Postgres service + migrations step would be needed in `.github/workflows/ci.yml`.

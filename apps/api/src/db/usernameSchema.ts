import { readFile } from 'node:fs/promises';
import type postgres from 'postgres';

/** Schema-only migration shared by the normal runner and the explicit command. */
export async function applyUsernameSchema(connection: postgres.Sql) {
  const ddl = await readFile(new URL('../../src/db/migrations/username.sql', import.meta.url), 'utf8');
  await connection.begin(async transaction => { await transaction.unsafe(ddl); });
}

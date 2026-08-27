import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const url =
  process.env.DATABASE_URL ??
  'postgres://anticlock:anticlock@localhost:5432/anticlock';

export const sql = postgres(url, { max: 10 });
export const db = drizzle(sql, { schema });

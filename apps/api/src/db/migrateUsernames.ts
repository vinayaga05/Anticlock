import 'dotenv/config';
import { sql } from './client.js';
import { applyUsernameSchema } from './usernameSchema.js';

// Deliberately separate from the legacy migration runner, which also seeds data.
try {
  await applyUsernameSchema(sql);
  console.log('Username schema migration applied.');
} finally { await sql.end({ timeout: 5 }); }

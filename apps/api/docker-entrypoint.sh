#!/bin/sh
set -e

echo "Waiting for database..."
i=0
while true; do
  if node --input-type=module -e "
    import postgres from 'postgres';
    const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 2 });
    await sql\`select 1\`;
    await sql.end({ timeout: 1 });
  "; then
    break
  fi
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "Database not ready after 60s"
    exit 1
  fi
  sleep 1
done

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running migrations..."
  node /app/apps/api/dist/db/migrate.js
fi

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Seeding database..."
  node /app/apps/api/dist/seed/run.js
fi

echo "Starting API..."
cd /app/apps/api
exec node dist/index.js

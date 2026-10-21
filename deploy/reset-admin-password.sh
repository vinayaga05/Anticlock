#!/usr/bin/env bash
# Reset the production admin login to INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD
# from .env.production. Run on the VPS:
#
#   cd /opt/apps/Anticlock
#   chmod +x deploy/reset-admin-password.sh
#   ./deploy/reset-admin-password.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || {
  echo "error: $ENV_FILE not found" >&2
  exit 1
}

email="$(grep -E '^INITIAL_ADMIN_EMAIL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'" )"
password="$(grep -E '^INITIAL_ADMIN_PASSWORD=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'" )"

[[ -n "$email" && -n "$password" ]] || {
  echo "error: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in $ENV_FILE" >&2
  exit 1
}

PG_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'postgres' | head -1 || true)"
API_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'anticlock-api|api-1' | head -1 || true)"
[[ -n "$PG_CONTAINER" ]] || {
  echo "error: no postgres container running" >&2
  exit 1
}
[[ -n "$API_CONTAINER" ]] || {
  echo "error: no api container running (needed for bcrypt)" >&2
  exit 1
}

echo "postgres=$PG_CONTAINER api=$API_CONTAINER email=$email"

HASH="$(
  docker exec -e ADMIN_PASS="$password" "$API_CONTAINER" \
    node --input-type=module -e \
    "import bcrypt from 'bcryptjs'; process.stdout.write(await bcrypt.hash(process.env.ADMIN_PASS, 10));"
)"

[[ "$HASH" == \$2* ]] || {
  echo "error: failed to generate bcrypt hash: $HASH" >&2
  exit 1
}

# Escape single quotes for SQL string literals.
sql_escape() { printf "%s" "$1" | sed "s/'/''/g"; }
EMAIL_SQL="$(sql_escape "$email")"
HASH_SQL="$(sql_escape "$HASH")"

docker exec -i "$PG_CONTAINER" psql -U anticlock -d anticlock -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users (email, name, password_hash, is_active)
VALUES ('${EMAIL_SQL}', 'Knock Admin', '${HASH_SQL}', true)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    is_active = true,
    updated_at = now();

INSERT INTO user_roles (user_id, role_id)
SELECT id, 'super_admin' FROM users WHERE email = '${EMAIL_SQL}'
ON CONFLICT DO NOTHING;
SQL

echo "OK: password reset for ${email}"
echo "Test login:"
echo "  curl -sS -X POST https://api.anticlock.online/auth/admin/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"${email}\",\"password\":\"***\"}'"

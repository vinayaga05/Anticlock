#!/usr/bin/env bash
# Upload Canva MP4s to R2 (optional) and register them as published reels in Postgres.
# Run from repo root on the VPS after API image includes dist/seed/importR2Clips.js.
#
# Import objects already under canva/ in R2 (no local upload):
#   SKIP_UPLOAD=1 ./deploy/import-r2-clips.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose --env-file "$ENV_FILE" \
  -f docker-compose.production.yml \
  -f docker-compose.traefik.override.yml)

if [[ "${SKIP_UPLOAD:-0}" == 1 ]]; then
  echo "Importing existing canva/ R2 objects → Postgres…"
  "${COMPOSE[@]}" exec -T api node dist/seed/importR2Clips.js
else
  if [ ! -d assets/canva-exports ]; then
    echo "error: assets/canva-exports not found in $ROOT (or set SKIP_UPLOAD=1)" >&2
    exit 1
  fi
  echo "Importing Canva clips → R2 + Postgres…"
  "${COMPOSE[@]}" run --rm --no-deps \
    --entrypoint node \
    -v "$ROOT/assets/canva-exports:/canva:ro" \
    -w /app/apps/api \
    api dist/seed/importR2Clips.js --upload-dir /canva
fi

echo ""
echo "Done. Verify:"
echo "  curl -sk https://\${API_DOMAIN:-api.anticlock.online}/v1/reels"

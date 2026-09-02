#!/usr/bin/env bash
# Anticlock VPS deploy helper — run from the repository root on the server.
#
# Hostinger (Traefik owns :80/:443):
#   ./deploy/vps-deploy.sh first
#   ./deploy/vps-deploy.sh update
#
# Standalone VPS (Caddy in compose):
#   EDGE=caddy ./deploy/vps-deploy.sh first
#   EDGE=caddy ./deploy/vps-deploy.sh update
#
# Other commands: recreate | verify | status | ps
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
EDGE="${EDGE:-traefik}"

usage() {
  cat <<'EOF'
Usage: ./deploy/vps-deploy.sh <command>

Commands:
  first     Build and start the full stack (first deploy)
  update    git pull, build, migrate, recreate web services
  recreate  Force-recreate api (+ admin, and caddy if EDGE=caddy) without rebuild
  verify    Run post-deploy health checks
  status    Show anticlock container status
  ps        docker compose ps

Environment:
  EDGE=traefik|caddy   Edge proxy mode (default: traefik)
  ENV_FILE=...         Env file path (default: .env.production)
  SKIP_GIT_PULL=1      Skip git pull during update

Examples:
  ./deploy/vps-deploy.sh first
  ./deploy/vps-deploy.sh update
  EDGE=caddy ./deploy/vps-deploy.sh update
  ./deploy/vps-deploy.sh verify
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

require_env_file() {
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found. Copy .env.production.example and fill in values."
}

compose() {
  local args=(docker compose --env-file "$ENV_FILE" -f docker-compose.production.yml)
  case "$EDGE" in
    traefik) args+=(-f docker-compose.traefik.override.yml) ;;
    caddy) ;;
    *) die "EDGE must be 'traefik' or 'caddy', got: $EDGE" ;;
  esac
  "${args[@]}" "$@"
}

web_services() {
  if [[ "$EDGE" == caddy ]]; then
    echo "api admin caddy"
  else
    echo "api admin"
  fi
}

read_domain() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  [[ -n "$line" ]] || return 1
  echo "${line#*=}" | tr -d '"'"'"
}

cmd_first() {
  require_env_file
  echo "==> First deploy (EDGE=$EDGE)"
  if [[ "$EDGE" == traefik ]]; then
    compose up -d --build redis postgres
    compose rm -sf migrate || true
    compose up migrate
    compose up -d --build api admin
  else
    compose up -d --build
  fi
  compose ps
  cmd_verify || true
}

cmd_update() {
  require_env_file
  echo "==> Update deploy (EDGE=$EDGE)"
  if [[ "${SKIP_GIT_PULL:-0}" != 1 ]]; then
    git pull --ff-only
  fi
  compose build
  compose rm -sf migrate || true
  compose up migrate
  # shellcheck disable=SC2046
  compose up -d --no-deps $(web_services)
  compose ps
  cmd_verify || true
}

cmd_recreate() {
  require_env_file
  echo "==> Recreate web services (EDGE=$EDGE)"
  # shellcheck disable=SC2046
  compose up -d --force-recreate $(web_services)
  compose ps
  cmd_verify || true
}

cmd_status() {
  docker ps --filter name=anticlock --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

cmd_ps() {
  require_env_file
  compose ps
}

cmd_verify() {
  require_env_file
  local api_domain admin_domain
  api_domain="$(read_domain API_DOMAIN || echo api.anticlock.online)"
  admin_domain="$(read_domain ADMIN_DOMAIN || echo admin.anticlock.online)"

  echo "==> Verification (API=$api_domain ADMIN=$admin_domain EDGE=$EDGE)"
  cmd_status
  echo

  echo "-- public API health"
  if curl -sk --connect-timeout 15 "https://${api_domain}/health"; then
    echo
  else
    echo "(public API check failed)"
  fi
  echo

  echo "-- public admin login"
  curl -sk --connect-timeout 15 -o /dev/null -w 'admin HTTP %{http_code}\n' \
    "https://${admin_domain}/login" || echo "(admin check failed)"
  echo

  if [[ "$EDGE" == traefik ]]; then
    echo "-- traefik label on api container"
    docker inspect anticlock-api-1 --format '{{index .Config.Labels "traefik.enable"}}' 2>/dev/null \
      || echo "(anticlock-api-1 not found)"
    echo

    echo "-- local Traefik route (Host header)"
    curl -sk --connect-timeout 10 -H "Host: ${api_domain}" https://127.0.0.1/health || true
    echo
  fi

  echo "-- recent API logs"
  docker logs anticlock-api-1 2>&1 | tail -10 || true
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    first) cmd_first ;;
    update) cmd_update ;;
    recreate) cmd_recreate ;;
    verify) cmd_verify ;;
    status) cmd_status ;;
    ps) cmd_ps ;;
    -h|--help|help|'') usage ;;
    *) die "unknown command: $cmd (run with --help)" ;;
  esac
}

main "$@"

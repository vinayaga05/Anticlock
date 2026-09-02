# Deploy

Production deployment assets for Anticlock.

| File | Purpose |
| --- | --- |
| [hostinger-vps.md](./hostinger-vps.md) | Full VPS guide — Traefik vs Caddy, DNS, secrets, updates, troubleshooting |
| [vps-deploy.sh](./vps-deploy.sh) | Copy-paste deploy script for the VPS (run from repo root) |
| [caddy/Caddyfile](./caddy/Caddyfile) | Caddy reverse-proxy config (standalone VPS path only) |

## Quick start (Hostinger + Traefik)

On the VPS, from the repository root (for example `/opt/apps/Anticlock`):

```bash
cp .env.production.example .env.production   # first time only
chmod 600 .env.production
# edit .env.production — see hostinger-vps.md

chmod +x deploy/vps-deploy.sh

# First deploy (build all services, run migrate via compose)
./deploy/vps-deploy.sh first

# After git pull — build, migrate, recreate api + admin
./deploy/vps-deploy.sh update

# Health checks only
./deploy/vps-deploy.sh verify
```

Use Caddy instead of Traefik on a standalone VPS:

```bash
EDGE=caddy ./deploy/vps-deploy.sh first
EDGE=caddy ./deploy/vps-deploy.sh update
```

See [hostinger-vps.md](./hostinger-vps.md) for DNS, R2 CORS, backups, and Genie AI env vars.

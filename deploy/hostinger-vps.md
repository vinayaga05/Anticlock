# Anticlock on a Hostinger VPS

This is the production deployment topology for Anticlock. It deliberately
keeps the existing `docker-compose.yml` for local development and uses
`docker-compose.production.yml` only on the VPS.

The React Native app is not a VPS service. Metro stays on a developer Mac;
Android and iOS release bundles call the HTTPS API directly (for example
`https://api.anticlock.online`).

## Choose an edge proxy

Hostinger VPS images often ship with **Traefik** already bound to ports `80`
and `443`. Anticlock supports two production edge setups:

| Setup | When to use | Compose files |
| --- | --- | --- |
| **Traefik** (recommended on Hostinger) | VPS already runs the bundled Traefik stack (`traefik-traefik-1`, `network_mode: host`) | `docker-compose.production.yml` + `docker-compose.traefik.override.yml` |
| **Caddy** | Fresh VPS with no reverse proxy, or you control ports `80`/`443` yourself | `docker-compose.production.yml` only (includes the `caddy` service) |

Do **not** run Caddy and Traefik on the same VPS — both want ports `80` and
`443`.

### Traefik topology (current Hostinger production)

```text
Internet
  │  HTTPS :80/:443
  ▼
Traefik (Hostinger stack, /docker/traefik/)
  ├── admin.anticlock.online ──► Next.js Admin container (:3000)
  └── api.anticlock.online   ──► Hono API container (:4000) ──► PostgreSQL
                                                                 (private network)
                                                 └───────────► Redis (Genie)
                                                 └───────────► Cloudflare R2 / Stream
```

Traefik discovers Anticlock via Docker labels on the `api` and `admin`
containers. The override file sets those labels and points Traefik at the
`anticlock_edge` network.

### Caddy topology (standalone VPS)

```text
Internet
  │  HTTPS :80/:443
  ▼
Caddy reverse proxy (Anticlock compose)
  ├── admin.example.com ──► Next.js Admin container
  └── api.example.com   ──► Hono API container ──► PostgreSQL
                                                      (private network)
                                      └───────────► Cloudflare R2 / Stream
```

---

## Server layout (Anticlock VPS)

| Item | Value |
| --- | --- |
| App path | `/opt/apps/Anticlock/` |
| Production env | `/opt/apps/Anticlock/.env.production` (never commit) |
| Traefik stack | `/docker/traefik/docker-compose.yml` |
| Compose project name | `anticlock` (networks: `anticlock_edge`, `anticlock_database`) |

**Important:** create and edit `.env.production` on the VPS. Do not copy a Mac
or hPanel export blindly — `POSTGRES_PASSWORD` and other secrets must match
what PostgreSQL was initialized with.

Access options:

- **SSH** (preferred): `ssh root@<vps-ip>`
- **hPanel → VPS → Docker Manager → Web console** when SSH keys are not set up

Prefer CLI deploys from `/opt/apps/Anticlock` over hPanel’s visual compose
editor; the editor can drift from the repo file (missing `migrate`, wrong env).

---

## Before the first deployment

1. Provision an Ubuntu VPS with Docker Compose available. A 2-vCPU, 8-GB RAM
   VPS is a reasonable starting point for this single-server topology.
2. Point DNS at the VPS **before** expecting public HTTPS (see [DNS](#dns)).
3. Allow inbound ports `80` and `443`. Restrict SSH (`22`) to your own IP when
   possible. Do not open `5432`, `3000`, or `4000` in the host firewall.
4. Clone the repository on the VPS:

   ```bash
   cd /opt/apps
   git clone <repo-url> Anticlock
   cd Anticlock
   ```

5. Create production configuration:

   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

6. Fill in all required values in `.env.production`:
   - unique `POSTGRES_PASSWORD` and a 32+-character `JWT_SECRET`;
   - real `ACME_EMAIL`, `ADMIN_DOMAIN`, and `API_DOMAIN`;
   - strong `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` for the first
     administrator;
   - Cloudflare R2 credentials and both pre-created buckets. `MEDIA_STORAGE=r2`
     is the production default, so user media remains outside the VPS.

Never commit `.env.production`, database dumps, or storage credentials. Treat
any credential that was copied into a ticket, chat, terminal transcript, or
other shared surface as compromised and rotate it in the provider dashboard.

### DNS

In **hPanel → Domains → anticlock.online → DNS / Nameservers → DNS records**,
add **A** records pointing at the VPS public IP (for example `93.127.206.123`):

| Type | Name | Points to | TTL |
| --- | --- | --- | --- |
| A | `api` | `<vps-ip>` | 14400 |
| A | `admin` | `<vps-ip>` | 14400 |

Set `API_DOMAIN=api.anticlock.online` and
`ADMIN_DOMAIN=admin.anticlock.online` in `.env.production` to match.

Verify propagation:

```bash
dig +short api.anticlock.online A admin.anticlock.online A
curl -sk https://api.anticlock.online/health
```

Traefik/Let’s Encrypt will fail with `NXDOMAIN` until these records exist.

### R2 browser-upload CORS

The Admin generates presigned browser-upload URLs, so configure a CORS policy
on each R2 bucket that accepts uploads. Replace the origin with your actual
admin domain; it must match exactly and must not have a trailing slash.

```json
[
  {
    "AllowedOrigins": ["https://admin.anticlock.online"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Use the same policy for both the public-media and private-documents buckets
when Admin can upload to both. Add only the methods and headers the client
actually needs; do not use a wildcard origin for private uploads.

### Reel video workflow

The Admin upload flow uses a short-lived, signed R2 `PUT` URL. The Admin
browser receives only that URL and its required `Content-Type` header; R2
account credentials stay in the API container. The API records the file as a
Media Library asset, checks the object headers and a small MP4 signature range
on completion, and never proxies the full video through the VPS.

An uploaded video is only a `ready` Media Library asset. It does not create or
publish a Reel. An editor must attach it to a draft Reel and explicitly select
**Publish**; the mobile app reads only the published Reel API feed.

Reel uploads accept `video/mp4` only, use browser metadata to reject files
over three minutes before a signed URL is issued, and are capped by
`MEDIA_UPLOAD_MAX_VIDEO_BYTES` (250 MB by default). H.264 video with AAC audio
in a 9:16, 1080 × 1920 MP4 is recommended. R2 stores the original MP4; it does
not produce adaptive HLS renditions. Add Cloudflare Stream later if you need
transcoding or multi-quality playback.

The default public-media bucket lets a ready MP4 be delivered directly once a
Reel is published, but its URL can be addressable before publication. It will
not appear in Clips until the Reel is explicitly published. If draft-file
privacy is a hard requirement, use a private staging bucket and copy/promote
the file to the public delivery bucket on Publish; that is a deliberate future
workflow rather than an implicit side effect of upload.

## Application readiness note

The production SMS OTP adapter is currently a placeholder. Do not expose a
public phone-login flow until a real provider integration (for example MSG91),
its credentials, delivery monitoring, and rate limiting are implemented. The
VPS configuration is ready for the API itself, but it cannot make an
unimplemented external authentication service live.

---

## Deploy with Traefik (Hostinger)

Use this path when `traefik-traefik-1` is already running and owns `80`/`443`.
Do **not** start the `caddy` service from `docker-compose.production.yml`.

### Compose helper

Always pass both compose files and the production env file:

```bash
cd /opt/apps/Anticlock

COMPOSE="docker compose --env-file .env.production \
  -f docker-compose.production.yml \
  -f docker-compose.traefik.override.yml"
```

Or use the deploy script (recommended):

```bash
chmod +x deploy/vps-deploy.sh
./deploy/vps-deploy.sh first      # first deploy
./deploy/vps-deploy.sh update     # after git pull
./deploy/vps-deploy.sh verify     # health checks
./deploy/vps-deploy.sh recreate   # label/env change, no rebuild
```

See [deploy/README.md](./README.md) for all commands. On the Traefik path the
script does **not** start Caddy (ports `80`/`443` are already taken).

The override file (`docker-compose.traefik.override.yml`) adds Traefik labels:

- `traefik.enable=true`
- `traefik.docker.network=anticlock_edge`
- Routers for `${API_DOMAIN}` → port `4000`, `${ADMIN_DOMAIN}` → port `3000`
- TLS via Traefik’s `letsencrypt` certificate resolver

### First deployment

Set `RUN_SEED=true` for the first deployment. The one-shot `migrate` service
creates the schema, catalog roles, and the configured first admin; demo content
is disabled unless `SEED_DEMO_DATA=true` is explicitly set.

```bash
cd /opt/apps/Anticlock

$COMPOSE up -d --build
$COMPOSE ps
```

Confirm health:

```bash
# From the VPS (Traefik routing by Host header)
curl -sk -H 'Host: api.anticlock.online' https://127.0.0.1/health

# Public (after DNS propagates)
curl -sk https://api.anticlock.online/health
curl -sk -o /dev/null -w '%{http_code}\n' https://admin.anticlock.online/login
```

Expected API response:

```json
{"ok":true,"service":"anticlock-api","version":"0.1.0","redis":true}
```

Open the admin site and sign in with the credentials from `.env.production`.
Once the initial database is ready, set `RUN_SEED=false` unless a future release
deliberately needs an idempotent catalog seed update.

If Traefik logged ACME `NXDOMAIN` errors before DNS was added, restart Traefik
after the A records propagate:

```bash
docker restart traefik-traefik-1
```

### Deploying an update

Pull the intended Git revision, build, run migrations, then recreate web
services with the Traefik override:

```bash
cd /opt/apps/Anticlock

git pull --ff-only

$COMPOSE build
$COMPOSE rm -sf migrate
$COMPOSE up migrate
$COMPOSE up -d --no-deps api admin
```

The Admin API origin is compiled during its Docker build. If `API_DOMAIN`
changes, rebuild the Admin image as part of the same deployment.

Quick recreate after label or env changes (no rebuild):

```bash
$COMPOSE up -d --force-recreate api admin
```

---

## Deploy with Caddy (standalone VPS)

Use this path when nothing else is listening on ports `80` and `443`.

### First deployment

```bash
cd /opt/apps/Anticlock

docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Confirm `https://<API_DOMAIN>/health` returns JSON, then open the admin site.

Caddy stores certificate state in Docker volumes, so certificate renewals are
automatic while the service is running.

### Deploying an update

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml rm -sf migrate
docker compose --env-file .env.production -f docker-compose.production.yml up migrate
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-deps api admin caddy
```

---

## Verification checklist

Run after every deploy:

```bash
# Container health
docker ps --filter name=anticlock --format 'table {{.Names}}\t{{.Status}}'

# API (replace domain if different)
curl -sk https://api.anticlock.online/health

# Admin login page
curl -sk -o /dev/null -w 'admin:%{http_code}\n' https://admin.anticlock.online/login

# Traefik labels present (Traefik path only)
docker inspect anticlock-api-1 --format '{{index .Config.Labels "traefik.enable"}}'
# Expected: true

# API logs — AI provider ready, listening on 4000
docker logs anticlock-api-1 2>&1 | tail -20
```

---

## Troubleshooting

### Public URL fails but containers are healthy

1. **Missing Traefik labels** — `curl https://127.0.0.1/health` returns `404`.
   Redeploy with `docker-compose.traefik.override.yml` and recreate `api`/`admin`.
2. **DNS not set** — Traefik logs show `NXDOMAIN` for `api.…` / `admin.…`.
   Add A records in hPanel (see [DNS](#dns)).
3. **Caddy port conflict** — Traefik and Caddy both bind `80`/`443`. Stop or
   remove Caddy from the stack on Traefik VPSes.

### Postgres auth / migrate crash loop

If the API or `migrate` service fails with password authentication errors:

1. Confirm `POSTGRES_PASSWORD` in `.env.production` matches the running DB.
2. If the volume was initialized with a different password, sync inside Postgres:

   ```bash
   docker exec -it anticlock-postgres-1 psql -U anticlock -d anticlock \
     -c "ALTER USER anticlock PASSWORD '<password-from-env>';"
   ```

3. Recreate the API:

   ```bash
   $COMPOSE up -d --force-recreate api
   ```

### hPanel Docker Manager vs CLI

- hPanel may store env vars separately and use a trimmed compose file.
- If `docker compose … run migrate` reports `no such service: migrate`, use
  the repo’s `docker-compose.production.yml` from `/opt/apps/Anticlock` instead.
- After hPanel edits, reconcile with `git pull` and redeploy from CLI.

---

## Backups and recovery

The PostgreSQL volume protects data across container replacement, but it is not
an off-VPS backup. Schedule an encrypted `pg_dump` at least daily and copy it
to a separate provider or account (for example, a dedicated private R2 backup
bucket). Keep multiple restore points and perform a test restore regularly.

Before any schema-changing deployment, take and verify a fresh backup. A safe
rollback consists of returning to the prior Git revision and redeploying its
containers; restore the database only when a tested backup is needed, because
database rollbacks are not automatically safe.

## Genie AI providers

Genie uses a server-side AI provider abstraction. **Groq is the default** for
development and testing. API keys never reach the React Native client.

Add these to `.env.production`:

```dotenv
AI_PROVIDER=groq
AI_FALLBACK_PROVIDER=openai

GROQ_API_KEY=gsk_your_groq_key
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-20b

OPENAI_API_KEY=sk_your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

ASSISTANT_MAX_TURNS=8
```

Switch to OpenAI only:

```dotenv
AI_PROVIDER=openai
```

Enable one-time OpenAI fallback after retryable Groq failures:

```dotenv
AI_PROVIDER=groq
AI_FALLBACK_PROVIDER=openai
```

Both the active and fallback providers require their respective API keys when
configured. On startup the API logs only `{ provider, model, fallbackProvider }`
— never credentials or prompts.

Supported models must support tool calling. Defaults:
`openai/gpt-oss-20b` (Groq) and `gpt-4.1-mini` (OpenAI).

## What stays out of this VPS

- Metro and simulator/emulator tooling
- large user uploads, images, and videos (use R2 / Stream)
- MinIO and background workers until there is a concrete queue or
  processing requirement. **Redis is required** for Genie (session buffer,
  rate limiting) and is included in the production compose file on the
  private `database` network.

This is a single-VPS starting point, not high availability. Add managed
database replicas, workers, monitoring/alerts, and a load balancer only as
traffic and operational requirements justify them.

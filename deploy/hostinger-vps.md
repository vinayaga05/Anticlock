# Anticlock on a Hostinger VPS

This is the production deployment topology for Anticlock. It deliberately
keeps the existing `docker-compose.yml` for local development and uses
`docker-compose.production.yml` only on the VPS.

```text
Internet
  │  HTTPS :80/:443
  ▼
Caddy reverse proxy
  ├── admin.anticlock.com ──► Next.js Admin container
  └── api.anticlock.com   ──► Hono API container ──► PostgreSQL
                                                      (private network)
                                      └───────────► Cloudflare R2 / Stream
```

The React Native app is not a VPS service. Metro stays on a developer Mac;
Android and iOS release bundles call `https://api.anticlock.com` directly.

## Before the first deployment

1. Provision an Ubuntu VPS with Docker Compose available. A 2-vCPU, 8-GB RAM
   VPS is a reasonable starting point for this single-server topology.
2. Point the `admin.anticlock.com` and `api.anticlock.com` DNS A/AAAA records
   at the VPS. DNS must be live before Caddy can issue certificates.
3. Allow inbound ports `80` and `443`. Restrict SSH (`22`) to your own IP when
   possible. Do not open `5432`, `3000`, or `4000` in the host firewall.
4. Clone the repository on the VPS, then create its untracked production
   configuration:

   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

5. Fill in all required values in `.env.production`:
   - unique `POSTGRES_PASSWORD` and a 32+-character `JWT_SECRET`;
   - real `ACME_EMAIL`, `ADMIN_DOMAIN`, and `API_DOMAIN`;
   - strong `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` for the first
     administrator;
   - Cloudflare R2 credentials and both pre-created buckets. `MEDIA_STORAGE=r2`
     is the production default, so user media remains outside the VPS.

Never commit `.env.production`, database dumps, or storage credentials. Treat
any credential that was copied into a ticket, chat, terminal transcript, or
other shared surface as compromised and rotate it in the provider dashboard.

### R2 browser-upload CORS

The Admin generates presigned browser-upload URLs, so configure a CORS policy
on each R2 bucket that accepts uploads. Replace the origin with your actual
admin domain; it must match exactly and must not have a trailing slash.

```json
[
  {
    "AllowedOrigins": ["https://admin.anticlock.com"],
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

## First deployment

Set `RUN_SEED=true` for the first deployment. The one-shot `migrate` service
creates the schema, catalog roles, and the configured first admin; demo content
is disabled unless `SEED_DEMO_DATA=true` is explicitly set.

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Confirm `https://api.anticlock.com/health` returns JSON, then open the admin
site and sign in with the credentials from `.env.production`. Once the initial
database is ready, set `RUN_SEED=false` unless a future release deliberately
needs an idempotent catalog seed update.

Caddy stores certificate state in Docker volumes, so certificate renewals are
automatic while the service is running.

## Deploying an update

Pull the intended Git revision, build it, and explicitly run the one-shot
migration job before recreating the web services. This keeps schema changes out
of normal API startup.

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml rm -sf migrate
docker compose --env-file .env.production -f docker-compose.production.yml up migrate
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-deps api admin caddy
```

The Admin API origin is compiled during its Docker build. If `API_DOMAIN`
changes, rebuild the Admin image as part of the same deployment.

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
GROQ_MODEL=llama-3.3-70b-versatile

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
`llama-3.3-70b-versatile` (Groq) and `gpt-4.1-mini` (OpenAI).

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

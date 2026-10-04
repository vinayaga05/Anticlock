# Secrets and Configuration Guide

This document lists all environment variables used across the Anticlock monorepo, explains their purpose, indicates whether they are required or optional, and provides guidance on where to configure them.

## Table of Contents

- [API (`apps/api`)](#api-appsapi)
- [Admin (`apps/admin`)](#admin-appsadmin)
- [Mobile (`apps/mobile`)](#mobile-appsmobile)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [GitHub Actions Secrets](#github-actions-secrets)
- [Pre-Launch Checklist](#pre-launch-checklist)
- [Branch Protection Recommendations](#branch-protection-recommendations)

---

## API (`apps/api`)

### Core / Server

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `NODE_ENV` | Optional | No | Environment mode | `production`, `development` |
| `API_PORT` | Optional | No | HTTP server port | `4000` |
| `API_HOST` | Optional | No | HTTP server bind address | `0.0.0.0` |
| `API_PUBLIC_URL` | **Required (prod)** | No | Public API base URL for CORS | `https://api.anticlock.online` |
| `ADMIN_ORIGIN` | **Required (prod)** | No | Admin dashboard origin for CORS | `https://admin.anticlock.online` |

### Database

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `DATABASE_URL` | **Required (prod)** | **Yes** | Postgres connection string | `postgres://user:pass@host:5432/db` |

**Local default:** `postgres://anticlock:anticlock@localhost:5432/anticlock`

### Authentication

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `JWT_SECRET` | **Required (prod)** | **Yes** | JWT signing secret (min 32 chars in prod) | `your-long-random-secret-here` |

**Security:** Generate a unique value per environment. Never reuse dev credentials in production.

### Redis

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `REDIS_URL` | Optional | Partial | Redis connection string for sessions, rate limiting | `redis://redis:6379` |

**Local default:** `redis://127.0.0.1:6379`

### Media Storage (Cloudflare R2)

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `MEDIA_STORAGE` | Optional | No | Storage backend (`r2` or `local`) | `r2` |
| `MEDIA_UPLOAD_MAX_VIDEO_BYTES` | Optional | No | Max video upload size in bytes | `262144000` (250 MB) |
| `R2_ACCOUNT_ID` | Required if R2 | No | Cloudflare R2 account ID | `abc123...` |
| `R2_ENDPOINT` | Optional | No | R2 API endpoint | `https://<account>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Required if R2 | **Yes** | R2 access key | `your-access-key` |
| `R2_SECRET_ACCESS_KEY` | Required if R2 | **Yes** | R2 secret key | `your-secret-key` |
| `R2_BUCKET_PUBLIC` | Optional | No | Public media bucket name | `anticlock-public-media` |
| `R2_BUCKET_PRIVATE` | Optional | No | Private documents bucket name | `anticlock-private-documents` |
| `R2_PUBLIC_BASE_URL` | Optional | No | CDN/custom domain for public media | `https://media.example.com` |

### Cloudflare Stream (Video)

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `STREAM_ACCOUNT_ID` | Optional | No | Cloudflare Stream account ID | `abc123...` |
| `STREAM_API_TOKEN` | Optional | **Yes** | Cloudflare Stream API token | `your-api-token` |
| `STREAM_CUSTOMER_SUBDOMAIN` | Optional | No | Custom Stream subdomain | `customer-subdomain` |
| `STREAM_WEBHOOK_SECRET` | Optional | **Yes** | Webhook signature verification secret | `your-webhook-secret` |
| `STREAM_MAX_DURATION_SECONDS` | Optional | No | Max video duration | `180` |

### AI Providers (Genie Assistant)

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `AI_PROVIDER` | Optional | No | Primary AI provider (`groq` or `openai`) | `groq` |
| `AI_FALLBACK_PROVIDER` | Optional | No | Fallback AI provider | `openai` |
| `AI_REQUEST_TIMEOUT_MS` | Optional | No | AI request timeout in milliseconds | `30000` |
| `GROQ_API_KEY` | Required for Groq | **Yes** | Groq API key | `gsk_...` |
| `GROQ_BASE_URL` | Optional | No | Groq API base URL | `https://api.groq.com/openai/v1` |
| `GROQ_MODEL` | Optional | No | Groq model name | `openai/gpt-oss-20b` |
| `OPENAI_API_KEY` | Required for OpenAI | **Yes** | OpenAI API key | `sk-...` |
| `OPENAI_BASE_URL` | Optional | No | OpenAI API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Optional | No | OpenAI model name | `gpt-4.1-mini` |
| `ASSISTANT_MAX_TURNS` | Optional | No | Max conversation turns | `8` |
| `ASSISTANT_PERSONA_VERSION` | Optional | No | Assistant persona version | `1` |

### Algolia (Search)

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `ALGOLIA_APP_ID` | Optional | No | Algolia application ID | `your-app-id` |
| `ALGOLIA_API_KEY` | Optional | **Yes** | Algolia API key | `your-api-key` |
| `ALGOLIA_REELS_INDEX` | Optional | No | Algolia reels index name | `anticlock_reels` |

### OTP (One-Time Password)

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `OTP_DEV_WHITELIST` | Optional | No | Enable dev OTP whitelist (auto-true in dev) | `true` |
| `MSG91_AUTH_KEY` | Required for SMS | **Yes** | MSG91 authentication key for SMS OTP | `your-msg91-key` |

**Note:** In development, a whitelist OTP provider is used automatically. Configure MSG91 for production SMS delivery.

### KYC Encryption

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `KYC_ENCRYPTION_KEY` | **Required (prod)** | **Yes** | AES-256-GCM encryption key for KYC data | `your-encryption-key` |

**Security:** Generate a strong random key for production. Never commit this value.

### Seeding

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `RUN_SEED` | Optional | No | Run database seed on startup | `true` |
| `SEED_DEMO_DATA` | Optional | No | Include demo data in seed | `false` |
| `INITIAL_ADMIN_EMAIL` | Optional | No | Initial admin account email | `admin@anticlock.online` |
| `INITIAL_ADMIN_PASSWORD` | Optional | Partial | Initial admin account password | `Admin@123` (change in prod!) |

**Security:** Change `INITIAL_ADMIN_PASSWORD` to a strong value before first production deployment.

### Monitoring (Optional)

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `SENTRY_DSN` | Optional | Partial | Sentry DSN for error tracking | `https://...@sentry.io/...` |
| `SENTRY_ENVIRONMENT` | Optional | No | Sentry environment name | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional | No | Sentry performance tracing sample rate | `0.1` (10%) |

**Setup:** When `SENTRY_DSN` is set, install `@sentry/node` package:
```bash
pnpm add @sentry/node --filter @anticlock/api
```

---

## Admin (`apps/admin`)

### Core

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `NODE_ENV` | Optional | No | Environment mode | `production` |
| `NEXT_PUBLIC_API_URL` | **Required** | No | API base URL (public, client-side) | `https://api.anticlock.online` |

**Local default:** `http://localhost:4000`

**Note:** `NEXT_PUBLIC_*` variables are embedded in the client bundle. Never put secrets here.

### Monitoring (Optional)

Sentry for Next.js is **not installed** but can be added using `@sentry/nextjs`:

```bash
pnpm add @sentry/nextjs --filter @anticlock/admin
npx @sentry/wizard@latest -i nextjs
```

Configure via `next.config.js` and `sentry.client.config.js` / `sentry.server.config.js`. See [Sentry Next.js docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/).

---

## Mobile (`apps/mobile`)

### Core

| Variable | Required | Sensitive | Description | Example |
|----------|----------|-----------|-------------|---------|
| `USE_PRODUCTION_ENVIRONMENT` | Hardcoded | No | Compile-time flag in `src/shared/api/config.ts` | `true` |

**Note:** Mobile does not use `process.env` at runtime. Configuration is hardcoded in `apps/mobile/src/shared/api/config.ts`:

- `USE_PRODUCTION_ENVIRONMENT`: Set to `true` to use `https://api.anticlock.online` (production API)
- `DEV_LAN_HOST`: Set to your local network IP for local API testing when `USE_PRODUCTION_ENVIRONMENT` is `false`

To switch between production and local API, edit the constant in the source file and rebuild.

### Monitoring (Optional)

Sentry for React Native is **not installed** but can be added using `@sentry/react-native`:

```bash
pnpm add @sentry/react-native --filter @anticlock/mobile
npx @sentry/wizard -i reactNative
```

Configure via `sentry.properties` and initialization in `App.tsx`. See [Sentry React Native docs](https://docs.sentry.io/platforms/react-native/).

**Build-time configuration:** Consider using react-native-config or a build variant system to inject Sentry DSN at build time instead of hardcoding it.

### Firebase (Push Notifications)

The mobile app may use Firebase for push notifications. Store the service account JSON securely:

- **Local:** Place `firebase-service-account.json` in a secure location outside the repo
- **CI/CD:** Store as a GitHub Actions secret and write to file during build
- **Production:** Configure via Cloudflare R2, AWS Secrets Manager, or similar

Variable reference (if used in backend API):
- `FIREBASE_SERVICE_ACCOUNT_JSON` (base64-encoded JSON or file path)

---

## Local Development

### Setup

1. **Copy example env file:**
   ```bash
   cp .env.production.example .env.local
   ```

2. **Configure local values in `.env.local`:**
   - Set `DATABASE_URL` to your local Postgres instance
   - Set `REDIS_URL` to your local Redis (or use default)
   - Set `JWT_SECRET` to any value (dev default is used if omitted)
   - Set `ADMIN_ORIGIN` to `http://localhost:3000`
   - Set `API_PUBLIC_URL` to `http://localhost:4000`
   - Set AI provider keys (`GROQ_API_KEY` or `OPENAI_API_KEY`)
   - Leave R2/Stream/Algolia/MSG91 unset to use local/mock equivalents

3. **Run services:**
   ```bash
   docker compose up -d  # Start Postgres and Redis
   pnpm install
   pnpm --filter @anticlock/api db:migrate
   pnpm --filter @anticlock/api db:seed
   ```

4. **Start dev servers:**
   ```bash
   pnpm dev:api    # API on :4000
   pnpm dev:admin  # Admin on :3000
   pnpm dev:mobile # React Native Metro
   ```

---

## Production Deployment

### Environment Variables

**Set in production host (Docker Compose, Kubernetes, Cloudflare, etc.):**

#### Required

- `NODE_ENV=production`
- `DATABASE_URL` (Postgres connection string)
- `JWT_SECRET` (min 32 characters, unique per environment)
- `ADMIN_ORIGIN` (e.g., `https://admin.anticlock.online`)
- `API_PUBLIC_URL` (e.g., `https://api.anticlock.online`)
- `REDIS_URL`
- `GROQ_API_KEY` or `OPENAI_API_KEY` (depending on `AI_PROVIDER`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (if using R2)
- `KYC_ENCRYPTION_KEY` (strong random key for KYC data)

#### Optional but Recommended

- `SENTRY_DSN` (error tracking)
- `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY` (search)
- `STREAM_ACCOUNT_ID`, `STREAM_API_TOKEN` (video hosting)
- `MSG91_AUTH_KEY` (SMS OTP)

#### Admin Build

When building the admin Next.js app, ensure `NEXT_PUBLIC_API_URL` is set at build time:

```bash
NEXT_PUBLIC_API_URL=https://api.anticlock.online pnpm --filter @anticlock/admin build
```

Or set it in `.env.production` or `.env.local` before building.

### Docker Compose

See `.env.production.example` for a production-ready template. Copy it to `.env.production` and fill in the values:

```bash
cp .env.production.example .env.production
# Edit .env.production with production values
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

---

## GitHub Actions Secrets

For CI/CD workflows that need credentials (e.g., deploying to production, running E2E tests with real services), configure these secrets in your GitHub repository settings:

### Required for Deployment

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `KYC_ENCRYPTION_KEY`

### Optional for CI

- `GROQ_API_KEY` or `OPENAI_API_KEY` (if running integration tests)
- `SENTRY_DSN` (if deploying with Sentry enabled)
- `ALGOLIA_API_KEY` (if testing search)
- `MSG91_AUTH_KEY` (if testing SMS OTP)

**Note:** The current CI workflow (`ci.yml`) does not require external secrets. API tests use mocked providers and do not connect to live databases or services.

---

## Pre-Launch Checklist

Before deploying to production, review and complete:

### Security

- [ ] **JWT_SECRET:** Generate a new, strong secret (min 32 chars). Do not reuse dev credentials.
- [ ] **DATABASE_URL:** Use a strong database password. Do not use default `anticlock:anticlock`.
- [ ] **KYC_ENCRYPTION_KEY:** Generate a strong random encryption key. Store securely.
- [ ] **Disable demo login:** Ensure `TEST_LOGIN_DISABLED=true` or remove demo login code in `apps/api/src/routes/auth.ts` if present.
- [ ] **Disable demo seed data:** Set `SEED_DEMO_DATA=false` in production.
- [ ] **Initial admin password:** Change `INITIAL_ADMIN_PASSWORD` to a strong value before first deploy.
- [ ] **Review CORS origins:** Ensure `ADMIN_ORIGIN` and `API_PUBLIC_URL` are correct.

### Configuration

- [ ] **R2 buckets:** Create `R2_BUCKET_PUBLIC` and `R2_BUCKET_PRIVATE` in Cloudflare R2.
- [ ] **R2 custom domain:** Configure `R2_PUBLIC_BASE_URL` with a custom domain for public media.
- [ ] **Redis:** Ensure Redis is running and `REDIS_URL` is correct.
- [ ] **Sentry:** If using, install `@sentry/node` and set `SENTRY_DSN`.
- [ ] **Algolia:** If using search, configure `ALGOLIA_APP_ID` and `ALGOLIA_API_KEY`.
- [ ] **Cloudflare Stream:** If using video hosting, configure `STREAM_*` variables.
- [ ] **MSG91:** If using SMS OTP, configure `MSG91_AUTH_KEY`.

### Testing

- [ ] **Health checks:** Verify `/health` and `/ready` endpoints return `ok: true`.
- [ ] **Run migrations:** Ensure all database migrations are applied (`pnpm --filter @anticlock/api db:migrate`).
- [ ] **Run seed:** Run `db:seed` once to create roles and initial admin account.
- [ ] **Test admin login:** Log in to admin dashboard with initial admin credentials.
- [ ] **Test mobile registration:** Register a new mobile user via OTP.

---

## Branch Protection Recommendations

To ensure code quality and prevent accidental deployments, configure branch protection rules for `main`:

### GitHub Branch Protection Settings

1. **Require pull request reviews before merging**
   - At least 1 approval required
   - Dismiss stale reviews on new commits

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - **Required checks:**
     - `setup` (CI workflow)
     - `typecheck` (CI workflow)
     - `test-api` (CI workflow)
     - `build-admin` (CI workflow)
   - **Optional checks (informational, not required):**
     - `android-assemble-debug` (Android Build workflow)
     - Mobile typecheck (already non-blocking in CI)

3. **Require conversation resolution before merging**
   - Ensure all PR comments are addressed

4. **Require linear history** (optional)
   - Enforces rebase/squash merges for cleaner history

5. **Include administrators**
   - Apply rules to repository admins

6. **Restrict who can push to matching branches**
   - Only allow merges via pull requests

### Deployment

- **Production deploys:** Trigger from `main` branch only after all checks pass
- **Staging deploys:** Can trigger from feature branches for preview
- **Rollback plan:** Tag production releases for easy rollback (`git tag v1.0.0`)

---

## Summary

This document covers all environment variables and secrets used in the Anticlock monorepo. Keep this document updated as new integrations are added. Never commit real secrets to the repository. Use environment-specific `.env` files (ignored by `.gitignore`) or secret management services for production credentials.

For questions or issues, refer to the README or contact the development team.

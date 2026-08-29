# Anticlock

Lifestyle marketplace monorepo: **Admin** (CMS/control center) → **API** → **PostgreSQL** → **Mobile** (React Native).

## Workspace layout

```text
apps/
  mobile/     # React Native 0.86 app (host only)
  admin/      # Next.js control center
  api/        # Hono API + Drizzle
packages/
  contracts/  # Shared Zod schemas + types
  tsconfig/   # Shared TS base
```

The Admin ownership boundaries and rollout plan are documented in
[Admin Control Center](docs/admin-control-center.md).

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for backend stack)
- Node `>= 22.11` + [pnpm](https://pnpm.io) `9.x` (for mobile / local overrides)
- Xcode / Android Studio for mobile

## Quick start (Docker — Postgres + API + Admin)

One command brings up the control plane:

```bash
pnpm docker:up
# or: docker compose up -d --build
```

| Service  | URL / port              |
|----------|-------------------------|
| Admin    | http://localhost:3000   |
| API      | http://localhost:4000   |
| Postgres | `localhost:5432`        |

- Seed login: `admin@anticlock.app` / `admin123`
- API migrate + seed run automatically on container start
- Media files persist in the `anticlock_media` volume

Useful commands:

```bash
pnpm docker:ps      # status
pnpm docker:logs    # follow logs
pnpm docker:down    # stop stack
```

React Native is **not** containerized — run it on the host (below).

## Production — Hostinger VPS

The production stack is intentionally separate from the local Compose file:

```text
Internet (HTTPS)
       |
     Caddy
    /     \
 Admin    API --- PostgreSQL (private Docker network)
              \
               Cloudflare R2 / Stream
```

- Caddy is the only container with public ports (`80`, `443`); it obtains and
  renews TLS certificates automatically.
- Admin and API are private Docker services behind `admin.anticlock.com` and
  `api.anticlock.com`.
- PostgreSQL has a persistent volume but no published host port.
- Metro remains a local development tool. Release mobile builds call the
  HTTPS API directly.

See [the VPS deployment guide](deploy/hostinger-vps.md) before deploying. It
covers DNS, secrets, first-time initialization, updates, backups, and rollback.

## Local override (without Docker apps)

If you prefer host processes (API/Admin still need Postgres):

```bash
docker compose up -d postgres
pnpm install
pnpm --filter @anticlock/contracts build
pnpm db:migrate && pnpm db:seed
pnpm dev:api      # :4000
pnpm dev:admin    # :3000
```

### Mobile

```bash
pnpm install
pnpm dev:mobile
# or: pnpm --filter @anticlock/mobile ios|android
```

Debug builds keep mocks by default. Release builds use
`https://api.anticlock.com`; update `PRODUCTION_API_BASE_URL` in
`apps/mobile/src/shared/api/config.ts` if your deployed API uses a different
domain. For a local API, set `DEVELOPMENT_API_BASE_URL` to a device-reachable
URL (for example `http://10.0.2.2:4000` on an Android emulator).

On Android emulator, Metro must be reachable for debug assets/videos. `pnpm
dev:mobile` / `android` run `adb reverse tcp:8081 tcp:8081` automatically.

### Reel videos → Cloudflare R2

In the Admin, choose **Media** → **Upload** or **Reels** → **Upload MP4**.
The browser reads the video metadata, requests a short-lived signed upload URL
from the API, and uploads directly to R2. The completed asset is available in
the Media Library, but it is not a Reel and it is not public in Clips until an
editor attaches it to a draft Reel and explicitly publishes that Reel.

Release mobile builds obtain Clips only from the published Reel API feed. An
R2 object upload—whether through the Admin or a utility script—never creates a
published Reel by itself.

For legacy Canva test imports, export MP4 clips into `assets/canva-exports/`,
enable **R2** on your Cloudflare account, add credentials to `apps/api/.env`,
then upload:

```bash
pnpm --filter @anticlock/api r2:upload-canva
```

For adaptive HLS instead of MP4, use Cloudflare Stream:
`pnpm --filter @anticlock/api stream:upload-canva`.

See [assets/canva-exports/README.md](assets/canva-exports/README.md).

### Android release APK (R8)

Release builds enable **R8** shrinking + obfuscation and resource shrinking
(`minifyEnabled` / `shrinkResources` in `apps/mobile/android/app/build.gradle`).
Keep rules live in `apps/mobile/android/app/proguard-rules.pro`.

```bash
# Requires JDK (Android Studio JBR is fine)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

pnpm --filter @anticlock/mobile android:release   # APK
pnpm --filter @anticlock/mobile android:bundle    # AAB (Play Store)
```

| Output | Path |
|--------|------|
| APK | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| AAB | `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab` |
| R8 mapping | `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` |

Archive `mapping.txt` for every release — you need it to de-obfuscate crash stacks.

**Signing:** without upload-key props, release still signs with the debug
keystore (local installs only). For Play Store, generate a keystore and add to
`~/.gradle/gradle.properties` (do not commit secrets):

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

Place the `.keystore` under `apps/mobile/android/app/`. See
[React Native — signed APK](https://reactnative.dev/docs/signed-apk-android).

**Note:** R8 hardens Java/Kotlin bytecode only. Hermes JS bytecode and native
`.so` libraries are not fully protected against reverse engineering.

Default ABIs are `armeabi-v7a,arm64-v8a` (see `android/gradle.properties`).
`x86` / `x86_64` are omitted — they are unused on Apple Silicon emulators /
Play devices, and `react-native-mmkv` (Nitro) does not link reliably for those
ABIs. Override with `-PreactNativeArchitectures=...` only if you need them.

If you hit `NitroModules.so ... missing and no known rule to make it`, clean
native caches then rebuild (the root `android/build.gradle` also patches this
AGP prefab naming bug automatically):

```bash
rm -rf node_modules/react-native-mmkv/android/.cxx \
       node_modules/react-native-mmkv/android/build \
       node_modules/react-native-nitro-modules/android/.cxx \
       node_modules/react-native-nitro-modules/android/build
pnpm --filter @anticlock/mobile android:release
```

## Phase 1 + Media

- Auth + RBAC, audit, seeded catalog
- Media library (local or R2), Admin upload/reuse
- Mobile API client gated by env until Phase 11

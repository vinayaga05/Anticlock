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

To point mobile at the API, set `API_BASE_URL` in
`apps/mobile/src/shared/api/config.ts` (e.g. `http://localhost:4000`).
Mocks remain the default fallback.

On Android emulator, Metro must be reachable for debug assets/videos. `pnpm
dev:mobile` / `android` run `adb reverse tcp:8081 tcp:8081` automatically.

### Canva test videos → Cloudflare R2

Export MP4 clips from Canva into `assets/canva-exports/`, enable **R2** on your Cloudflare account, add credentials to `apps/api/.env`, then upload:

```bash
pnpm --filter @anticlock/api r2:upload-canva
```

For adaptive HLS instead of MP4, use Cloudflare Stream: `pnpm --filter @anticlock/api stream:upload-canva`

See [assets/canva-exports/README.md](assets/canva-exports/README.md). Until upload completes, the mobile app plays bundled Canva-export MP4s in **Clips** and the yoga **Flash** video post.

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

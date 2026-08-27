# Canva test videos → Cloudflare R2 / Stream

Export MP4 clips from [Canva](https://www.canva.com/) (or drop any short vertical MP4 here), then upload to **Cloudflare R2** (MP4 URLs) or **Cloudflare Stream** (HLS) for playback in the mobile app.

## 1. Export from Canva

1. Open your Canva design with video.
2. **Share → Download → MP4 Video**.
3. Save files into this folder (`assets/canva-exports/`).

Suggested filenames (or rename after export):

| File | Used for |
|------|----------|
| `yoga-flow.mp4` | Flash yoga post + Clips reel |
| `fitness-reel.mp4` | Clips reel |
| `health-tips.mp4` | Clips reel |

Copy new exports into the mobile bundle (optional until upload):

```bash
cp assets/canva-exports/*.mp4 apps/mobile/src/shared/assets/videos/canva/
```

## 2. Enable R2 on Cloudflare

Your API token is valid, but **R2 must be enabled** on the account first:

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Storage & databases → R2**.
2. Click **Enable R2** (free tier includes 10 GB/month).
3. Ensure your API token has **Workers R2 Storage Write** (or Admin Read & Write) permission.

## 3. Configure credentials

Your bucket is **`reels`** with public URL **`https://pub-27960762dc094de6aef7fc922fec002a.r2.dev`**.

Add to `apps/api/.env`:

```env
R2_ACCOUNT_ID=371c68b07056de23faafec0088f7ca7e
R2_ENDPOINT=https://371c68b07056de23faafec0088f7ca7e.r2.cloudflarestorage.com
R2_BUCKET_PUBLIC=reels
R2_PUBLIC_BASE_URL=https://pub-27960762dc094de6aef7fc922fec002a.r2.dev
R2_ACCESS_KEY_ID=<from R2 Manage API Tokens>
R2_SECRET_ACCESS_KEY=<from R2 Manage API Tokens>
MEDIA_STORAGE=r2
```

Create S3 credentials: **R2 → Manage API Tokens → Create API token → Object Read & Write → bucket `reels`**.

> The account-wide `cfat_` API token is **not** the same as R2 S3 keys and may belong to a different Cloudflare account.

## 4. Upload to R2 (recommended)

```bash
pnpm --filter @anticlock/api r2:upload-canva
```

This creates the public bucket (if needed), enables the `r2.dev` URL, uploads MP4s, and updates `apps/mobile/src/shared/data/cloudflare-videos.manifest.json`.

## 5. Upload to Stream (optional HLS)

Requires **Cloudflare Stream** enabled on the account:

```env
STREAM_ACCOUNT_ID=your_account_id
STREAM_API_TOKEN=your_api_token
```

```bash
pnpm --filter @anticlock/api stream:upload-canva
```

Restart Metro after either upload to pick up manifest changes.

## 6. App behavior

- **Before upload:** bundled MP4s from `apps/mobile/src/shared/assets/videos/canva/`.
- **After R2 upload:** public MP4 URLs in the manifest (Clips + Flash).
- **After Stream upload:** HLS `.m3u8` URLs in the manifest.

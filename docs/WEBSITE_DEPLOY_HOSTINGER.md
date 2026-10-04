# Deploying Anticlock Marketing Website to Hostinger

This guide covers deploying the `apps/web` Next.js marketing website to Hostinger hosting.

## Table of Contents

1. [Deployment Options](#deployment-options)
2. [Prerequisites](#prerequisites)
3. [Option A: Static Export (Recommended)](#option-a-static-export-recommended)
4. [Option B: Node.js Hosting](#option-b-nodejs-hosting)
5. [DNS Configuration](#dns-configuration)
6. [SSL & HTTPS](#ssl--https)
7. [GitHub Actions Auto-Deploy](#github-actions-auto-deploy)
8. [Manual Deployment](#manual-deployment)
9. [Verification](#verification)
10. [Troubleshooting](#troubleshooting)

---

## Deployment Options

### Option A: Static Export (Recommended)

- **Best for**: Marketing websites with no server-side logic
- **Hosting**: Shared hosting, any static host, Hostinger File Manager
- **Cost**: Lowest (works on basic Hostinger plans)
- **Deployment**: Upload `out/` folder to `public_html/`
- **Performance**: Fastest (no Node.js runtime)

### Option B: Node.js Hosting

- **Best for**: Dynamic routes, API routes, server features
- **Hosting**: Hostinger VPS or Node.js hosting plan
- **Cost**: Higher (requires VPS or Node.js support)
- **Deployment**: PM2 or Node.js process manager
- **Performance**: Good, but adds server overhead

**For Anticlock marketing site**: **Use Static Export (Option A)** unless you add server features later.

---

## Prerequisites

1. **Hostinger Account** with:
   - Shared hosting plan (for static) OR VPS (for Node.js)
   - Domain configured (e.g., `anticlock.online` or `www.anticlock.online`)

2. **Production Domain**:
   - Main API is already at `api.anticlock.online` (do NOT overwrite it)
   - Marketing site should use:
     - `anticlock.online` (apex domain) OR
     - `www.anticlock.online` (www subdomain) OR
     - `www.anticlock.online` pointing to a subdomain like `site.anticlock.online`

3. **Local Build**:
   - From monorepo root or `apps/web`:
     ```bash
     pnpm install
     pnpm --filter @anticlock/web build
     ```

---

## Option A: Static Export (Recommended)

### Step 1: Enable Static Export

In `apps/web/next.config.ts`, uncomment:

```ts
export default {
  reactStrictMode: true,
  output: 'export', // ← Enable this
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};
```

### Step 2: Build for Production

```bash
cd apps/web
pnpm build
```

This creates an `out/` directory with all static files.

### Step 3: Upload to Hostinger

#### Via File Manager (Manual)

1. Log in to Hostinger **hPanel**
2. Open **File Manager**
3. Navigate to `public_html/` (or subdomain folder)
4. Upload all contents of `apps/web/out/` to `public_html/`
   - `_next/`, `*.html`, `sitemap.xml`, `robots.txt`, etc.

#### Via FTP

1. Connect with FTP client (FileZilla, Cyberduck)
   - Host: Your domain or Hostinger FTP hostname
   - User: FTP username from hPanel
   - Password: FTP password
   - Port: 21 (or 22 for SFTP)

2. Upload `apps/web/out/*` to `public_html/`

### Step 4: Configure `.htaccess` (Clean URLs & Caching)

Create or edit `public_html/.htaccess`:

```apache
# Anticlock Marketing Website - Static Export Configuration

# Enable Rewrite Engine
RewriteEngine On

# Force HTTPS (if SSL is enabled)
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Redirect www to non-www (or vice versa, choose one)
# Option 1: www → apex (anticlock.online)
RewriteCond %{HTTP_HOST} ^www\.anticlock\.online$ [NC]
RewriteRule ^(.*)$ https://anticlock.online/$1 [L,R=301]

# Option 2: apex → www (www.anticlock.online)
# RewriteCond %{HTTP_HOST} ^anticlock\.online$ [NC]
# RewriteRule ^(.*)$ https://www.anticlock.online/$1 [L,R=301]

# Clean URLs: /about → /about.html
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^([^/]+)$ $1.html [L]

# 404 handling
ErrorDocument 404 /404.html

# Caching headers for static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/avif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>
```

**Important**: Choose either www → apex OR apex → www redirect (not both).

### Step 5: Set Environment Variables

Hostinger shared hosting doesn't support `.env` files for static sites. Instead:

1. **During build**, set env vars:
   ```bash
   NEXT_PUBLIC_SITE_URL=https://anticlock.online pnpm build
   ```

2. Or update `.env.production` locally before building:
   ```env
   NEXT_PUBLIC_SITE_URL=https://anticlock.online
   NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/...
   NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/...
   ```

---

## Option B: Node.js Hosting

### Step 1: Prepare for Node.js

Keep `output: 'export'` commented out in `next.config.ts`.

### Step 2: Build for Production

```bash
cd apps/web
pnpm build
```

Output: `.next/` directory (not `out/`).

### Step 3: Upload to VPS

1. SSH into Hostinger VPS:
   ```bash
   ssh user@your-vps-ip
   ```

2. Install Node.js 22+ and pnpm:
   ```bash
   curl -fsSL https://fnm.vercel.app/install | bash
   fnm install 22
   fnm use 22
   npm install -g pnpm
   ```

3. Upload project:
   ```bash
   rsync -avz --exclude node_modules --exclude .next apps/web user@vps:/var/www/anticlock-web/
   ```

4. Install dependencies and build on server:
   ```bash
   cd /var/www/anticlock-web
   pnpm install --prod
   pnpm build
   ```

### Step 4: Run with PM2

```bash
pm2 start pnpm --name "anticlock-web" -- start
pm2 save
pm2 startup
```

### Step 5: Reverse Proxy (Nginx or Apache)

#### Nginx Example

```nginx
server {
  listen 80;
  server_name anticlock.online www.anticlock.online;

  location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Enable HTTPS with Certbot:

```bash
sudo certbot --nginx -d anticlock.online -d www.anticlock.online
```

---

## DNS Configuration

### Scenario 1: Apex Domain (anticlock.online)

**If API is at `api.anticlock.online` (subdomain)**:

1. **A Record**: `anticlock.online` → Your Hostinger IP
2. **A Record**: `api.anticlock.online` → API server IP (already configured)
3. Optional: **CNAME**: `www.anticlock.online` → `anticlock.online`

### Scenario 2: www Subdomain (www.anticlock.online)

1. **CNAME**: `www.anticlock.online` → `anticlock.online`
2. **A Record**: `anticlock.online` → Your Hostinger IP (or redirect to www)

**DNS Propagation**: Can take 1-48 hours. Use [whatsmydns.net](https://www.whatsmydns.net) to check.

---

## SSL & HTTPS

### Hostinger Shared Hosting

1. In hPanel, go to **SSL** section
2. Select your domain
3. Enable **Free SSL** (Let's Encrypt)
4. Wait 10-15 minutes for activation
5. Force HTTPS via `.htaccess` (see above)

### Hostinger VPS

Use Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d anticlock.online -d www.anticlock.online
sudo systemctl reload nginx
```

Auto-renewal is handled by Certbot timer.

---

## GitHub Actions Auto-Deploy

Create `.github/workflows/deploy-web.yml` in the monorepo root:

```yaml
name: Deploy Marketing Website

on:
  push:
    branches:
      - main
    paths:
      - 'apps/web/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build website
        working-directory: apps/web
        env:
          NEXT_PUBLIC_SITE_URL: https://anticlock.online
          NEXT_PUBLIC_APP_STORE_URL: ${{ secrets.APP_STORE_URL }}
          NEXT_PUBLIC_PLAY_STORE_URL: ${{ secrets.PLAY_STORE_URL }}
        run: pnpm build

      - name: Deploy via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./apps/web/out/
          server-dir: /public_html/
          dangerous-clean-slate: false
```

### GitHub Secrets Setup

In your GitHub repo, go to **Settings → Secrets and variables → Actions**:

- `FTP_SERVER`: Hostinger FTP hostname (e.g., `ftp.anticlock.online`)
- `FTP_USERNAME`: Your FTP username
- `FTP_PASSWORD`: Your FTP password
- `APP_STORE_URL`: (optional) Apple App Store URL
- `PLAY_STORE_URL`: (optional) Google Play Store URL

**Security**: Never commit FTP credentials. Use GitHub Secrets.

---

## Manual Deployment

If GitHub Actions is not set up:

### Every Deploy

```bash
cd apps/web
NEXT_PUBLIC_SITE_URL=https://anticlock.online pnpm build
```

Then upload `out/` via FTP or File Manager (see Step 3 above).

---

## Verification

After deployment:

1. **Visit your domain**: `https://anticlock.online`
2. **Check HTTPS**: Lock icon in browser
3. **Test 404 page**: Visit `https://anticlock.online/nonexistent`
4. **Mobile responsive**: Test on phone or Chrome DevTools
5. **SEO tags**: View source, check `<meta>` tags
6. **Lighthouse score**: Run in Chrome DevTools → Lighthouse

### Expected Results

- ✅ HTTPS (green lock)
- ✅ Clean URLs (no `.html` in address bar)
- ✅ 404 page shows Anticlock branded error
- ✅ Mobile responsive, no horizontal scroll
- ✅ Lighthouse: 90+ Performance, 100 Accessibility, 100 SEO

---

## Troubleshooting

### Issue: 404 on all pages except home

**Cause**: `.htaccess` rewrite rules not working.

**Fix**:
1. Ensure `.htaccess` is in the correct directory (`public_html/`)
2. Check if `mod_rewrite` is enabled (usually is on Hostinger)
3. Contact Hostinger support to enable `AllowOverride All`

### Issue: Images not loading

**Cause**: Next.js Image optimization needs server (static export uses `<img>`).

**Fix**: Already handled—Next.js falls back to `<img>` in static export mode.

### Issue: Download buttons always say "Coming Soon"

**Cause**: Environment variables not set during build.

**Fix**: Rebuild with env vars:
```bash
NEXT_PUBLIC_APP_STORE_URL=https://... pnpm build
```

### Issue: DNS not resolving

**Cause**: DNS propagation delay or incorrect records.

**Fix**:
1. Check DNS with `dig anticlock.online` or [whatsmydns.net](https://www.whatsmydns.net)
2. Verify A/CNAME records in Hostinger DNS panel
3. Wait up to 48 hours for full propagation

### Issue: API still at `anticlock.online`, conflicts with website

**Cause**: API already uses apex domain.

**Fix**:
- Move API to `api.anticlock.online` (already done per README)
- Use `www.anticlock.online` for marketing site OR
- Use a separate subdomain like `www.anticlock.online` → marketing, `anticlock.online` → redirects to www

---

## Remaining Manual Steps

After first deployment:

1. **Upload real app screenshots** to `public_html/screens/` when available
2. **Replace OG image** (`public_html/og-image.png`) with branded 1200x630 image
3. **Add Privacy Policy & Terms** content (replace placeholders in hPanel or re-deploy)
4. **Set app store URLs** in GitHub Secrets (when apps are published)
5. **Test all links** and forms on production domain
6. **Monitor**: Set up Google Analytics, Search Console, or Cloudflare Analytics

---

## Summary

| Task | Static Export | Node.js Hosting |
|------|---------------|-----------------|
| Build | `pnpm build` → `out/` | `pnpm build` → `.next/` |
| Upload | FTP to `public_html/` | rsync to VPS |
| Server | None (static files) | PM2 + Node.js 22+ |
| `.htaccess` | Required | Optional (use Nginx) |
| SSL | Hostinger Free SSL | Certbot |
| Cost | Lowest (shared hosting) | Higher (VPS) |

**Recommended**: **Static Export** for Anticlock marketing website.

---

## Contact

For Hostinger-specific issues, contact Hostinger support or check their [Knowledge Base](https://support.hostinger.com).

For website code issues, refer to the main project README or open an issue in the repository.

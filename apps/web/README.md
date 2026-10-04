# Anticlock Marketing Website

Premium marketing website for Anticlock—a lifestyle super-app combining social video content with a comprehensive service marketplace.

## Overview

This is the production marketing website (`apps/web`) for the Anticlock monorepo. Built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Framer Motion.

## Technology Stack

- **Framework**: Next.js 15.3+ (App Router)
- **UI**: React 19, TypeScript
- **Styling**: Tailwind CSS 3.4+
- **Animations**: Framer Motion 11+ (motion-safe respecting prefers-reduced-motion)
- **Icons**: Lucide React
- **Deployment**: Static export ready for Hostinger (or server mode with Node.js)

## Features

- **Responsive Design**: Mobile-first, fluid from 320px to 1920px+ with no horizontal overflow
- **Premium UI**: Glassmorphism, gradients, smooth animations, floating elements
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation, high contrast
- **SEO Optimized**: Meta tags, Open Graph, Twitter Cards, JSON-LD structured data, sitemap, robots.txt
- **Performance**: Next.js Image optimization, lazy loading, prefers-reduced-motion support
- **Content-Driven**: Structured config files for easy content updates

## Project Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Home page
│   │   ├── not-found.tsx       # 404 page
│   │   ├── privacy/page.tsx    # Privacy policy (placeholder)
│   │   ├── terms/page.tsx      # Terms of service (placeholder)
│   │   ├── sitemap.ts          # Dynamic sitemap
│   │   ├── robots.ts           # Robots.txt
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── Navbar.tsx          # Sticky navigation with mobile menu
│   │   ├── Footer.tsx          # Footer with links
│   │   └── sections/           # Page sections
│   │       ├── HeroSection.tsx
│   │       ├── FeaturesSection.tsx
│   │       ├── ServicesSection.tsx
│   │       ├── HowItWorksSection.tsx
│   │       ├── WhyAnticlockSection.tsx
│   │       ├── ProvidersSection.tsx
│   │       ├── FAQSection.tsx
│   │       └── CTASection.tsx
│   ├── config/
│   │   ├── site.ts             # Site metadata, navigation
│   │   └── content.ts          # Features, services, FAQs
│   ├── lib/
│   │   ├── utils.ts            # Utility functions
│   │   └── metadata.ts         # SEO metadata generator
│   └── types/
│       └── index.ts            # TypeScript types
├── public/
│   ├── screens/                # App screenshot slots (recreated screens + space for real ones)
│   ├── images/                 # SVG illustrations, OG image
│   ├── favicon.ico
│   └── og-image.png
├── .env.example                # Environment variable template
├── .env.local                  # Local development env
└── README.md
```

## Environment Variables

Create `.env.local` for development:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3001

# Optional: Add when available
# NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/...
# NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/...
# NEXT_PUBLIC_TWITTER_URL=https://twitter.com/anticlock
# NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/anticlock
```

**Production** (`.env.production` or set in Hostinger):

```bash
NEXT_PUBLIC_SITE_URL=https://anticlock.online
```

When app store URLs are not set, download buttons show "Coming Soon" and are disabled.

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter @anticlock/web dev
```

Or from `apps/web`:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001)

## Build & Production

### Static Export (Recommended for Hostinger)

For a pure static site (no server features):

1. Enable static export in `next.config.ts`:
   ```ts
   output: 'export',
   ```

2. Build:
   ```bash
   pnpm build
   ```

3. Output is in `out/` directory. Upload to Hostinger `public_html/`.

### Node.js Mode (for server features)

If you need server-side features (e.g., dynamic routes, API routes):

1. Keep `next.config.ts` without `output: 'export'`
2. Build:
   ```bash
   pnpm build
   pnpm start
   ```

Deploy via PM2 or Node.js hosting on Hostinger VPS.

## Type Checking & Linting

```bash
pnpm typecheck
pnpm lint
```

## Content Management

All content lives in `src/config/`:

- **`site.ts`**: Site name, description, navigation, social links
- **`content.ts`**: Service trees, features, FAQs, provider benefits, how-it-works steps

Update these files to change website content without touching components.

## Screenshots & Images

**Real App Screenshots**:

This website is deployed in a cloud VM environment where the mobile app cannot run. Therefore, **real app screenshots are not available**.

The site is structured to support dropping in real screenshots later:

1. Place high-quality PNG/JPG screenshots in `public/screens/`:
   - `home.png`, `clips.png`, `shop.png`, `bookings.png`, etc.
2. Reference them in components as needed (currently showing placeholder phone mockups).

**Recreated Screens**:

Key app screens have been faithfully recreated as React/Tailwind components based on the actual mobile app code, theme, and copy. These serve as visual placeholders in device frames until real screenshots are captured.

**Brand Assets**:

- **OG Image** (`public/og-image.png`): 1200x630 placeholder for social sharing. Replace with branded version.
- **Illustrations**: SVG graphics can be added to `public/images/`.

## Deployment to Hostinger

See **[docs/WEBSITE_DEPLOY_HOSTINGER.md](../../docs/WEBSITE_DEPLOY_HOSTINGER.md)** for complete deployment instructions covering:

- Static export vs Node.js mode
- DNS configuration (apex vs www vs subdomain)
- SSL setup
- `.htaccess` for clean URLs and caching
- GitHub Actions workflow (FTP/SSH deploy)
- Manual deployment steps

**Important**: The marketing website uses a separate domain/subdomain from the API (`api.anticlock.online` already hosts the API server).

## SEO & Structured Data

- **Meta Tags**: Title, description, keywords, author
- **Open Graph**: Full OG tags for social sharing
- **Twitter Cards**: Large image card
- **Sitemap**: Auto-generated at `/sitemap.xml`
- **Robots.txt**: Generated at `/robots.txt`
- **JSON-LD**: Structured data for Organization and MobileApplication (when accurate)

## Accessibility

- Semantic HTML5 elements
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast ratios (WCAG AA compliant)
- `prefers-reduced-motion` respected (animations pause for users who prefer reduced motion)

## Performance Optimizations

- Next.js Image component with lazy loading
- Code splitting (Next.js automatic)
- CSS-in-JS eliminated (Tailwind only)
- Minimal JavaScript bundles
- Static generation where possible

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge) with ES6+ support. Fallbacks for older browsers are minimal—target audience uses up-to-date devices.

## Legal Pages

**Privacy Policy** and **Terms of Service** are placeholder pages clearly marked as "to be provided." They do not contain invented legal text—only structure and placeholders.

**Do not deploy to production without real legal documents.**

## License

Proprietary. Copyright © Anticlock. All rights reserved.

import { Hono } from 'hono';

const deepLinksRoutes = new Hono();

/**
 * Android App Links verification file.
 * 
 * SETUP REQUIRED:
 * Set ANDROID_SHA256_CERT_FINGERPRINTS environment variable with comma-separated
 * SHA-256 certificate fingerprints for your Android app signing keys.
 * 
 * Get fingerprints with:
 * - Debug: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey`
 * - Release: `keytool -list -v -keystore path/to/release.keystore -alias your-key-alias`
 * 
 * For Play Store apps, get the fingerprint from Play Console > Release > Setup > App Integrity.
 */
deepLinksRoutes.get('/.well-known/assetlinks.json', c => {
  const fingerprints = process.env.ANDROID_SHA256_CERT_FINGERPRINTS?.split(',')
    .map(fp => fp.trim())
    .filter(Boolean) || [];

  if (fingerprints.length === 0) {
    return c.json(
      { 
        error: 'ANDROID_SHA256_CERT_FINGERPRINTS not configured',
        setup: 'Add SHA-256 certificate fingerprints to environment variables'
      },
      500
    );
  }

  const assetlinks = fingerprints.map(fingerprint => ({
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'org.reactjs.native.example.AnticlockTemp',
      sha256_cert_fingerprints: [fingerprint],
    },
  }));

  return c.json(assetlinks, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  });
});

/**
 * iOS Universal Links configuration file.
 * 
 * SETUP REQUIRED:
 * Set these environment variables:
 * - APPLE_TEAM_ID: Your Apple Developer Team ID (10 characters)
 * - IOS_BUNDLE_ID: Your iOS app bundle identifier (default: org.reactjs.native.example.AnticlockTemp)
 * 
 * Find Team ID at: https://developer.apple.com/account (Membership Details)
 */
deepLinksRoutes.get('/.well-known/apple-app-site-association', c => {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const bundleId = process.env.IOS_BUNDLE_ID?.trim() || 'org.reactjs.native.example.AnticlockTemp';

  if (!teamId) {
    return c.json(
      {
        error: 'APPLE_TEAM_ID not configured',
        setup: 'Add your Apple Developer Team ID to environment variables'
      },
      500
    );
  }

  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          paths: ['*'],
        },
      ],
    },
  };

  return c.json(aasa, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  });
});

export { deepLinksRoutes };

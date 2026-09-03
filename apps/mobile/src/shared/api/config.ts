import { Platform } from 'react-native';

/**
 * Global environment switch for the mobile app.
 *
 * `true`  → production API (https://api.anticlock.online)
 * `false` → local/dev API + on-device OTP whitelist
 *
 * Flip this to test against the VPS from Metro/Simulator.
 * Release builds should keep this `true`.
 */
export const USE_PRODUCTION_ENVIRONMENT = true;

export const isProductionEnvironment = USE_PRODUCTION_ENVIRONMENT;
export const isDevEnvironment = !USE_PRODUCTION_ENVIRONMENT;

/**
 * Development API host:
 * - iOS Simulator / iOS on Mac: localhost reaches the Mac’s API process.
 * - Android emulator: 10.0.2.2 is the host loopback alias.
 * - Physical device on Wi‑Fi: set DEV_LAN_HOST to your Mac’s LAN IP.
 */
const DEV_LAN_HOST = '10.1.0.181';
const DEV_API_PORT = 4000;

/** Set true when running on a physical phone against a Mac API on the same Wi‑Fi. */
const USE_LAN_API_IN_DEV = false;

function developmentApiBaseUrl(): string {
  if (USE_LAN_API_IN_DEV) {
    return `http://${DEV_LAN_HOST}:${DEV_API_PORT}`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}

export const DEVELOPMENT_API_BASE_URL = developmentApiBaseUrl();
export const DEVELOPMENT_LAN_API_BASE_URL = `http://${DEV_LAN_HOST}:${DEV_API_PORT}`;

const PRODUCTION_API_BASE_URL = 'https://api.anticlock.online';

export const API_BASE_URL = USE_PRODUCTION_ENVIRONMENT
  ? PRODUCTION_API_BASE_URL
  : DEVELOPMENT_API_BASE_URL;

export const isApiEnabled = Boolean(API_BASE_URL);

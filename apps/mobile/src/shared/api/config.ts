import { NativeModules, Platform } from 'react-native';

/**
 * Global environment switch for the mobile app.
 *
 * Always use the hosted production API for development and device testing
 * (`https://api.anticlock.online`). Set to `false` only when you deliberately
 * need a local Docker/Metro API on the same Wi‑Fi.
 */
export const USE_PRODUCTION_ENVIRONMENT = true; // TEMP-LOCAL: device testing against production API

export const isProductionEnvironment = USE_PRODUCTION_ENVIRONMENT;
export const isDevEnvironment = !USE_PRODUCTION_ENVIRONMENT;

const DEV_LAN_HOST = '10.1.0.181';
const DEV_API_PORT = 4000;
const PRODUCTION_API_BASE_URL = 'https://api.anticlock.online';

/** Only used when USE_PRODUCTION_ENVIRONMENT is false. */
const FORCE_LAN_API_IN_DEV = false;

function metroDevHost(): string | null {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
    if (!scriptURL) return null;
    const match = scriptURL.match(/^\w+:\/\/([^/:]+)(?::\d+)?/);
    const host = match?.[1]?.trim();
    if (!host) return null;
    if (host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch {
    return null;
  }
}

function developmentApiBaseUrl(): string {
  if (FORCE_LAN_API_IN_DEV) {
    return `http://${DEV_LAN_HOST}:${DEV_API_PORT}`;
  }

  const fromMetro = metroDevHost();
  if (fromMetro) {
    return `http://${fromMetro}:${DEV_API_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}

/** Resolve at call time so Metro host is available after the bridge is ready. */
export function getApiBaseUrl(): string {
  return USE_PRODUCTION_ENVIRONMENT
    ? PRODUCTION_API_BASE_URL
    : developmentApiBaseUrl();
}

export const DEVELOPMENT_LAN_API_BASE_URL = `http://${DEV_LAN_HOST}:${DEV_API_PORT}`;
export const DEVELOPMENT_API_BASE_URL = DEVELOPMENT_LAN_API_BASE_URL;

/** Prefer getApiBaseUrl() for request-time resolution. */
export const API_BASE_URL = getApiBaseUrl();

export const isApiEnabled = true; // Production requirement: Always attempt API calls

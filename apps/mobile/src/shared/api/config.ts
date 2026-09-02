/**
 * Development points at the local API on this Mac’s LAN IP so physical devices
 * on the same Wi‑Fi can reach Genie. Simulators may use http://localhost:4000
 * instead. Set to '' to fall back to mocks.
 *
 * Release builds use the public API host. Until DNS is live for
 * api.anticlock.online, that is the VPS HTTP endpoint (cleartext on Android).
 */
const DEVELOPMENT_API_BASE_URL = 'http://10.1.0.181:4000';
const PRODUCTION_API_BASE_URL = 'http://srv1941188.hstgr.cloud:4000';

export const API_BASE_URL = __DEV__
  ? DEVELOPMENT_API_BASE_URL
  : PRODUCTION_API_BASE_URL;

export const isApiEnabled = Boolean(API_BASE_URL);

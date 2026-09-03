/**
 * Development points at the local API on this Mac’s LAN IP so physical devices
 * on the same Wi‑Fi can reach Genie. Simulators may use http://localhost:4000
 * instead. Set to '' to fall back to mocks.
 *
 * Release builds use the public HTTPS API (Traefik on the VPS). Port 4000 is
 * not exposed on the host — only https://api.anticlock.online works off-VPS.
 */
const DEVELOPMENT_API_BASE_URL = 'http://10.1.0.181:4000';
const PRODUCTION_API_BASE_URL = 'https://api.anticlock.online';

export const API_BASE_URL = __DEV__
  ? DEVELOPMENT_API_BASE_URL
  : PRODUCTION_API_BASE_URL;

export const isApiEnabled = Boolean(API_BASE_URL);

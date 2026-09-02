/**
 * Development deliberately stays on mocks until a developer opts into a
 * reachable local API. Release builds are bundled with the public HTTPS API;
 * Metro is never involved in production.
 *
 * Change this domain before creating a release if the production API uses a
 * different hostname. Until DNS is live for api.anticlock.online, release builds
 * use the VPS HTTP endpoint (requires cleartext traffic on Android).
 */
const DEVELOPMENT_API_BASE_URL = '';
const PRODUCTION_API_BASE_URL = 'http://srv1941188.hstgr.cloud:4000';

export const API_BASE_URL = __DEV__
  ? DEVELOPMENT_API_BASE_URL
  : PRODUCTION_API_BASE_URL;

export const isApiEnabled = Boolean(API_BASE_URL);

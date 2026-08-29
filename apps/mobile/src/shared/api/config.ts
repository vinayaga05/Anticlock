/**
 * Development deliberately stays on mocks until a developer opts into a
 * reachable local API. Release builds are bundled with the public HTTPS API;
 * Metro is never involved in production.
 *
 * Change this domain before creating a release if the production API uses a
 * different hostname. For local development use a simulator/device-reachable
 * origin, for example http://10.0.2.2:4000 on the Android emulator.
 */
const DEVELOPMENT_API_BASE_URL = '';
const PRODUCTION_API_BASE_URL = 'https://api.anticlock.com';

export const API_BASE_URL = __DEV__
  ? DEVELOPMENT_API_BASE_URL
  : PRODUCTION_API_BASE_URL;

export const isApiEnabled = Boolean(API_BASE_URL);

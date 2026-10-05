/**
 * Optional Sentry integration for error tracking and performance monitoring.
 * Only initialized when SENTRY_DSN environment variable is set.
 *
 * Setup:
 * 1. Install: pnpm add @sentry/node --filter @anticlock/api
 * 2. Set SENTRY_DSN in production environment
 * 3. Optionally set SENTRY_ENVIRONMENT (defaults to NODE_ENV)
 * 4. Optionally set SENTRY_TRACES_SAMPLE_RATE (defaults to 0.1 for 10%)
 */

let sentryEnabled = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    console.log('Sentry: not configured (SENTRY_DSN not set)');
    return;
  }

  try {
    // Sentry is optional; only import if DSN is set
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      integrations: [
        Sentry.httpIntegration(),
      ],
    });

    sentryEnabled = true;
    console.log('Sentry: initialized');
  } catch (error) {
    console.error('Sentry: failed to initialize', error);
  }
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!sentryEnabled) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.captureException(error, { extra: context });
  } catch {
    // Ignore errors in Sentry itself
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!sentryEnabled) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.captureMessage(message, level);
  } catch {
    // Ignore errors in Sentry itself
  }
}

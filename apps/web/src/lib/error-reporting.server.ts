import * as Sentry from '@sentry/node';
import { scrubEvent } from './error-reporting';

/** Серверні помилки рендеру (onRequestError у instrumentation.ts) — у Sentry, якщо задано SENTRY_DSN. */
let ready = false;

function init(): boolean {
  if (ready) return true;
  if (!process.env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.APP_VERSION,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    skipOpenTelemetrySetup: true,
    beforeSend: (event) => scrubEvent(event),
  });
  ready = true;
  return true;
}

export function reportServerError(
  error: unknown,
  context: { method?: string; path?: string; routePath?: string; routeType?: string },
): void {
  if (!init()) return;
  Sentry.withScope((scope) => {
    scope.setTag('side', 'web-server');
    if (context.method) scope.setTag('http.method', context.method);
    if (context.routePath) scope.setTag('route', context.routePath);
    if (context.routeType) scope.setTag('route.type', context.routeType);
    if (context.path) scope.setExtra('path', context.path.split('?')[0]);
    Sentry.captureException(error);
  });
}

/** Дочекатися відправлення (короткоживучі процеси/тести). */
export const flushErrors = (ms = 2000) => Sentry.flush(ms);

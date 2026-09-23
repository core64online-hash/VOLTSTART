import type { Instrumentation } from 'next';

/** Помилки серверного рендеру й обробників — у Sentry (лише Node-рантайм і лише з SENTRY_DSN). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // Саме така перевірка NEXT_RUNTIME дає змогу збирачу викинути Node-код із edge-збірки (middleware).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.SENTRY_DSN) return;
    const { reportServerError } = await import('./lib/error-reporting.server');
    reportServerError(error, {
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    });
  }
};

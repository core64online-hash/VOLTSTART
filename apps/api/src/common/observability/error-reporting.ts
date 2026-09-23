import { HttpException, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { catchError, throwError, type Observable } from 'rxjs';
import { ZodError } from 'zod';

/**
 * Звіти про помилки в Sentry (або сумісний сервіс, напр. GlitchTip). Увімкнено, лише якщо задано
 * SENTRY_DSN. Надсилаються тільки справжні збої (5xx і необроблені винятки) — без тіла запиту,
 * cookies, заголовків авторизації та query-рядків: персональні дані покупців у звіти не потрапляють.
 */
let enabled = false;

export function initErrorReporting(env: Record<string, string | undefined> = process.env): boolean {
  if (!env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? 'development',
    release: env.APP_VERSION,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Лише помилки: без OpenTelemetry-трасування (менше накладних витрат).
    skipOpenTelemetrySetup: true,
    beforeSend: (event) => scrubEvent(event),
  });
  enabled = true;
  return true;
}

/** Чи варто звітувати: помилки клієнта (4xx, зокрема валідація zod → 400) — це не збій сервера. */
export function shouldReport(err: unknown): boolean {
  if (err instanceof HttpException) return err.getStatus() >= 500;
  if (err instanceof ZodError) return false;
  return true;
}

export function reportError(err: unknown, context?: { method?: string; route?: string }): void {
  if (!enabled || !shouldReport(err)) return;
  Sentry.withScope((scope) => {
    if (context?.method) scope.setTag('http.method', context.method);
    if (context?.route) scope.setTag('http.route', context.route);
    Sentry.captureException(err);
  });
}

const stripQuery = (url: string) => url.split('?')[0].split('#')[0];

/**
 * Прибирає з події все, що може містити персональні дані чи секрети. Дані запиту (`request`)
 * прибираються цілком: без OpenTelemetry SDK не ізолює запити, тож там міг би опинитися інший
 * запит. Маршрут і метод — у тегах (з ErrorReportingInterceptor).
 */
export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  delete event.request;
  delete event.user;
  event.breadcrumbs = event.breadcrumbs?.map((b) =>
    b.data?.url ? { ...b, data: { ...b.data, url: stripQuery(String(b.data.url)) } } : b,
  );
  return event;
}

/** Глобальний перехоплювач: звітує про збої обробників, не змінюючи відповідь клієнту. */
@Injectable()
export class ErrorReportingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (context.getType() === 'http') {
          const req = context.switchToHttp().getRequest<{ method?: string; baseUrl?: string; route?: { path?: string } }>();
          const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : undefined;
          // 503 від /api/health/ready — очікуваний сигнал для моніторингу доступності, а не баг.
          if (!route?.startsWith('/api/health')) reportError(err, { method: req.method, route });
        } else {
          reportError(err);
        }
        return throwError(() => err);
      }),
    );
  }
}

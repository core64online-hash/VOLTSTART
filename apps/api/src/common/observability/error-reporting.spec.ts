import { BadRequestException, InternalServerErrorException, NotFoundException, type ExecutionContext } from '@nestjs/common';
import type { ErrorEvent } from '@sentry/node';
import { lastValueFrom, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ErrorReportingInterceptor, initErrorReporting, reportError, scrubEvent, shouldReport } from './error-reporting';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((fn: (scope: { setTag: (k: string, v: string) => void }) => void) => fn({ setTag: sentry.setTag })),
  setTag: vi.fn(),
}));
vi.mock('@sentry/node', () => sentry);

const httpContext = (req: Record<string, unknown>) =>
  ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

describe('звіти про помилки (Sentry)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('без SENTRY_DSN вимкнено й нічого не надсилає', () => {
    expect(initErrorReporting({})).toBe(false);
    reportError(new Error('boom'));
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('звітує лише про збої: 5xx і необроблені винятки, не про 4xx і валідацію', () => {
    expect(shouldReport(new Error('x'))).toBe(true);
    expect(shouldReport(new InternalServerErrorException())).toBe(true);
    expect(shouldReport(new NotFoundException())).toBe(false);
    expect(shouldReport(new BadRequestException())).toBe(false);
    const zodError = z.object({ a: z.string() }).safeParse({}).error;
    expect(shouldReport(zodError)).toBe(false);
  });

  it('з DSN: ініціалізація без PII і трасування; інтерсептор надсилає 500 з маршрутом і прокидає помилку далі', async () => {
    expect(
      initErrorReporting({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1', SENTRY_ENVIRONMENT: 'staging', APP_VERSION: 'abc' }),
    ).toBe(true);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'staging', release: 'abc', sendDefaultPii: false, tracesSampleRate: 0 }),
    );

    const interceptor = new ErrorReportingInterceptor();
    const boom = new Error('db down');
    const ctx = httpContext({ method: 'POST', baseUrl: '/api/orders', route: { path: '/:number/status' } });
    await expect(lastValueFrom(interceptor.intercept(ctx, { handle: () => throwError(() => boom) }))).rejects.toBe(boom);
    expect(sentry.captureException).toHaveBeenCalledWith(boom);
    expect(sentry.setTag).toHaveBeenCalledWith('http.method', 'POST');
    expect(sentry.setTag).toHaveBeenCalledWith('http.route', '/api/orders/:number/status');

    sentry.captureException.mockClear();
    const notFound = new NotFoundException();
    await expect(lastValueFrom(interceptor.intercept(ctx, { handle: () => throwError(() => notFound) }))).rejects.toBe(
      notFound,
    );
    expect(sentry.captureException).not.toHaveBeenCalled();

    // Недоступна БД на readiness — сигнал для моніторингу, а не звіт про баг.
    const health = httpContext({ method: 'GET', baseUrl: '/api/health', route: { path: '/ready' } });
    await expect(lastValueFrom(interceptor.intercept(health, { handle: () => throwError(() => boom) }))).rejects.toBe(boom);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('прибирає з події персональні дані й секрети', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://voltstar.ua/api/orders/track?email=a@b.ua&token=secret',
        query_string: 'email=a@b.ua',
        cookies: { session: 's' },
        data: { password: 'p' },
        headers: { authorization: 'Bearer t', cookie: 'c', 'user-agent': 'UA/1' },
      },
      user: { email: 'a@b.ua', ip_address: '1.2.3.4' },
      breadcrumbs: [{ category: 'http', data: { url: 'https://x/api/auth/reset?token=abc' } }],
    } as unknown as ErrorEvent);
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs?.[0].data?.url).toBe('https://x/api/auth/reset');
  });
});

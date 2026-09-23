/**
 * Звіти про помилки браузера в Sentry (або сумісний сервіс). Увімкнено, лише якщо під час збірки
 * задано NEXT_PUBLIC_SENTRY_DSN. SDK завантажується окремим чанком — без DSN сторінки не важчають.
 * Без PII: без IP, cookies, query-рядків у URL (там бувають email і токени скидання пароля).
 */
type Sdk = typeof import('@sentry/browser');

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sdk: Promise<Sdk | null> | null = null;

const stripQuery = (url: string) => url.split('?')[0].split('#')[0];

type Scrubbable = {
  request?: { url?: string; headers?: Record<string, string>; cookies?: unknown; query_string?: unknown };
  user?: unknown;
  breadcrumbs?: { data?: Record<string, unknown> }[];
};

/** Прибирає з події персональні дані (URL без query, без користувача й cookies). */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    delete event.request.cookies;
    delete event.request.query_string;
    const ua = event.request.headers?.['User-Agent'] ?? event.request.headers?.['user-agent'];
    event.request.headers = ua ? { 'User-Agent': ua } : {};
  }
  delete event.user;
  for (const b of event.breadcrumbs ?? []) {
    for (const key of ['url', 'from', 'to'] as const) {
      const v = b.data?.[key];
      if (typeof v === 'string') b.data![key] = stripQuery(v);
    }
  }
  return event;
}

export function initErrorReporting(): Promise<Sdk | null> {
  if (!DSN || typeof window === 'undefined') return Promise.resolve(null);
  sdk ??= import('@sentry/browser')
    .then((S) => {
      S.init({
        dsn: DSN,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
        release: process.env.NEXT_PUBLIC_APP_VERSION,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (crumb) => {
          // Кліки/введення не потрібні для діагностики й можуть містити дані форм.
          if (crumb.category === 'ui.input') return null;
          return crumb;
        },
      });
      return S;
    })
    .catch(() => null);
  return sdk;
}

export function reportClientError(error: unknown): void {
  void initErrorReporting().then((S) => S?.captureException(error));
}

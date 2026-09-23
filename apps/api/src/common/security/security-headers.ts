type Req = { path?: string; url?: string; secure?: boolean };
type Res = { setHeader(name: string, value: string): void; removeHeader(name: string): void };

/**
 * Захисні заголовки для API (без зовнішніх залежностей, аналог helmet для JSON-API).
 * API не віддає HTML, тож CSP максимально сувора; виняток — Swagger UI на /docs.
 */
export function securityHeaders(opts: { hsts: boolean }) {
  return (req: Req, res: Res, next: () => void): void => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    const path = req.path ?? req.url ?? '';
    if (!path.startsWith('/docs')) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    }
    if (opts.hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

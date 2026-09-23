import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { checkEnv, trustProxySetting } from './env-check';
import { GLOBAL_RULE, RATE_LIMIT_KEY, RateLimitGuard, RateLimitStore, SKIP_RATE_LIMIT_KEY, type RateLimitRule } from './rate-limit';
import { securityHeaders } from './security-headers';

describe('RateLimitStore', () => {
  const rule: RateLimitRule = { name: 't', limit: 2, windowSec: 60 };

  it('фіксоване вікно: ліміт, Retry-After, скидання після вікна', () => {
    const s = new RateLimitStore();
    expect(s.hit('k', rule, 0).allowed).toBe(true);
    expect(s.hit('k', rule, 1000).allowed).toBe(true);
    const third = s.hit('k', rule, 30_000);
    expect(third).toMatchObject({ allowed: false, retryAfterSec: 30, remaining: 0 });
    expect(s.hit('k', rule, 60_000).allowed).toBe(true);
    expect(s.hit('other', rule, 1000).allowed).toBe(true);
  });

  it('не росте безмежно: прибирає прострочені, а за потреби — найстаріші ключі', () => {
    const s = new RateLimitStore(10);
    for (let i = 0; i < 10; i++) s.hit(`a${i}`, rule, 0);
    s.hit('fresh', rule, 61_000);
    expect(s.size).toBe(1);
    for (let i = 0; i < 25; i++) s.hit(`b${i}`, rule, 70_000);
    expect(s.size).toBeLessThanOrEqual(10);
  });
});

function ctx(meta: { rules?: RateLimitRule[]; skip?: boolean }, req: Record<string, unknown>) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
    key === RATE_LIMIT_KEY ? meta.rules : key === SKIP_RATE_LIMIT_KEY ? meta.skip : undefined,
  );
  const headers: Record<string, unknown> = {};
  const context = {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ setHeader: (k: string, v: unknown) => (headers[k] = v) }) }),
  } as unknown as ExecutionContext;
  return { guard: new RateLimitGuard(reflector), context, headers };
}

describe('RateLimitGuard', () => {
  it('ліміт за email — незалежно від IP і регістру; 429 з Retry-After', () => {
    const rules: RateLimitRule[] = [{ name: 'login', limit: 1, windowSec: 60, by: 'email' }];
    const a = ctx({ rules }, { ip: '1.1.1.1', body: { email: 'A@x.ua' } });
    expect(a.guard.canActivate(a.context)).toBe(true);
    // Той самий екземпляр guard (спільне сховище), інша IP і інший регістр email.
    const other = ctx({ rules }, { ip: '2.2.2.2', body: { email: 'a@x.ua ' } }).context;
    try {
      a.guard.canActivate(other);
      expect.unreachable();
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(429);
    }
  });

  it('без email у тілі правило за email пропускається; @SkipRateLimit вимикає все', () => {
    const rules: RateLimitRule[] = [{ name: 'login', limit: 0, windowSec: 60, by: 'email' }];
    const noEmail = ctx({ rules }, { ip: '3.3.3.3', body: {} });
    expect(noEmail.guard.canActivate(noEmail.context)).toBe(true);
    const skipped = ctx({ rules: [{ name: 'x', limit: 0, windowSec: 60 }], skip: true }, { ip: '4.4.4.4' });
    expect(skipped.guard.canActivate(skipped.context)).toBe(true);
  });

  it('загальний ліміт діє на всі маршрути', () => {
    const c = ctx({}, { ip: '5.5.5.5' });
    for (let i = 0; i < GLOBAL_RULE.limit; i++) c.guard.canActivate(c.context);
    expect(() => c.guard.canActivate(c.context)).toThrow(HttpException);
    expect(c.headers['Retry-After']).toBeGreaterThan(0);
  });
});

describe('checkEnv', () => {
  const good = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: 'x'.repeat(40),
    API_CORS_ORIGINS: 'https://voltstar.ua,https://www.voltstar.ua',
    WEB_PUBLIC_URL: 'https://voltstar.ua',
    API_PUBLIC_URL: 'https://api.voltstar.ua',
    SMTP_HOST: 'smtp',
    TRUST_PROXY: '1',
  };

  it('коректна production-конфігурація — без помилок і попереджень', () => {
    expect(checkEnv(good)).toEqual({ errors: [], warnings: [] });
  });

  it('у production небезпечні значення — фатальні', () => {
    const { errors } = checkEnv({
      ...good,
      JWT_SECRET: 'change_me_in_production',
      API_CORS_ORIGINS: 'http://voltstar.ua,*',
      LIQPAY_SANDBOX: 'true',
      RATE_LIMIT_DISABLED: 'true',
      TYPESENSE_HOST: 'ts',
      TYPESENSE_API_KEY: 'voltstar_dev_key',
    });
    expect(errors.join('\n')).toMatch(/JWT_SECRET/);
    expect(errors.join('\n')).toMatch(/"\*"/);
    expect(errors.join('\n')).toMatch(/без HTTPS: http:\/\/voltstar.ua/);
    expect(errors.join('\n')).toMatch(/LIQPAY_SANDBOX/);
    expect(errors.join('\n')).toMatch(/RATE_LIMIT_DISABLED/);
    expect(errors.join('\n')).toMatch(/TYPESENSE_API_KEY/);
    expect(checkEnv({ ...good, JWT_SECRET: 'short' }).errors[0]).toMatch(/закороткий/);
  });

  it('у розробці ті самі проблеми — лише попередження', () => {
    const r = checkEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'change_me_in_production', API_CORS_ORIGINS: 'http://localhost:3000' });
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/JWT_SECRET/);
  });

  it('trust proxy: false/true/число/підмережі', () => {
    expect(trustProxySetting(undefined)).toBe(false);
    expect(trustProxySetting('true')).toBe(true);
    expect(trustProxySetting('2')).toBe(2);
    expect(trustProxySetting('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});

describe('securityHeaders', () => {
  const run = (path: string, hsts: boolean) => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v), removeHeader: vi.fn() };
    const next = vi.fn();
    securityHeaders({ hsts })({ path }, res, next);
    return { headers, next, res };
  };

  it('сувора CSP для API, без неї — на /docs; HSTS лише коли увімкнено', () => {
    const api = run('/api/catalog', true);
    expect(api.headers['Content-Security-Policy']).toContain("default-src 'none'");
    expect(api.headers['X-Frame-Options']).toBe('DENY');
    expect(api.headers['Strict-Transport-Security']).toContain('max-age=');
    expect(api.res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(api.next).toHaveBeenCalled();
    const docs = run('/docs/', false);
    expect(docs.headers['Content-Security-Policy']).toBeUndefined();
    expect(docs.headers['Strict-Transport-Security']).toBeUndefined();
  });
});

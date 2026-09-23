import {
  applyDecorators,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';

/**
 * Обмеження частоти запитів (захист від перебору паролів, спаму заявками, скрейпінгу).
 * Лічильники — у памʼяті процесу (фіксоване вікно). Для кількох інстансів API за балансувальником
 * ліміт діє на кожен інстанс окремо; спільне сховище (Redis) — наступний крок.
 */
export interface RateLimitRule {
  /** Назва правила — частина ключа, щоб різні маршрути не ділили лічильник. */
  name: string;
  limit: number;
  windowSec: number;
  /** ip — за адресою клієнта; email — за email із тіла (для входу/скидання паролю). */
  by?: 'ip' | 'email';
}

export const RATE_LIMIT_KEY = 'rate-limit';
export const SKIP_RATE_LIMIT_KEY = 'rate-limit:skip';

/** Загальний ліміт на будь-який маршрут — щедрий, лише від зловживань. */
export const GLOBAL_RULE: RateLimitRule = { name: 'global', limit: 600, windowSec: 60 };

export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT_KEY, rules);
/** Без ліміту (вебхуки платіжних систем, health-check). */
export const SkipRateLimit = () => applyDecorators(SetMetadata(SKIP_RATE_LIMIT_KEY, true));

export class RateLimitStore {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly maxKeys = 100_000) {}

  /** Реєструє звернення; повертає, чи дозволено, і скільки секунд до скидання вікна. */
  hit(key: string, rule: RateLimitRule, now = Date.now()): { allowed: boolean; retryAfterSec: number; remaining: number } {
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size >= this.maxKeys) this.sweep(now);
      entry = { count: 0, resetAt: now + rule.windowSec * 1000 };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= rule.limit,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      remaining: Math.max(0, rule.limit - entry.count),
    };
  }

  /** Прибирає прострочені вікна; якщо не допомогло — найстаріші записи (захист памʼяті). */
  private sweep(now: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    if (this.hits.size < this.maxKeys) return;
    const drop = Math.ceil(this.maxKeys / 10);
    let i = 0;
    for (const k of this.hits.keys()) {
      if (i++ >= drop) break;
      this.hits.delete(k);
    }
  }

  get size(): number {
    return this.hits.size;
  }
}

type LimitedRequest = {
  ip?: string;
  body?: unknown;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
};
type LimitedResponse = { setHeader(name: string, value: string | number): void };

/** Заголовок, яким web (SSR) позначає свої серверні запити до API. */
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

/**
 * Серверний рендер сайту ходить до API з однієї адреси (контейнер web), тож без винятку
 * впирався б у загальний ліміт за IP. Такі запити позначаються спільним секретом INTERNAL_API_TOKEN.
 */
export function isInternalRequest(headers: Record<string, unknown> | undefined, token = process.env.INTERNAL_API_TOKEN): boolean {
  const given = headers?.[INTERNAL_TOKEN_HEADER];
  if (!token || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new RateLimitStore();
  private readonly enabled = process.env.RATE_LIMIT_DISABLED !== 'true';

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.enabled || ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) return true;
    const rules = [GLOBAL_RULE, ...(this.reflector.getAllAndOverride<RateLimitRule[]>(RATE_LIMIT_KEY, targets) ?? [])];
    const req = ctx.switchToHttp().getRequest<LimitedRequest>();
    if (isInternalRequest(req.headers)) return true;
    const res = ctx.switchToHttp().getResponse<LimitedResponse>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

    for (const rule of rules) {
      const subject = rule.by === 'email' ? emailOf(req.body) : ip;
      if (!subject) continue;
      const result = this.store.hit(`${rule.name}:${subject}`, rule);
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSec);
        throw new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Забагато запитів. Спробуйте пізніше.', retryAfterSec: result.retryAfterSec },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }
}

function emailOf(body: unknown): string | null {
  const email = body && typeof body === 'object' ? (body as { email?: unknown }).email : undefined;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

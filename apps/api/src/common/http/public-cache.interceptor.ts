import {
  applyDecorators,
  Injectable,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { tap, type Observable } from 'rxjs';

/** Публічний кеш (браузер/CDN): хвилину свіжа відповідь, ще 5 хв — стара, поки оновлюється. */
export const PUBLIC_CACHE = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

/** Ставить Cache-Control лише на успішну відповідь — 404/помилки не кешуються. */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = ctx.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>();
    return next.handle().pipe(tap(() => res.setHeader('Cache-Control', PUBLIC_CACHE)));
  }
}

export const PublicCache = () => applyDecorators(UseInterceptors(PublicCacheInterceptor));

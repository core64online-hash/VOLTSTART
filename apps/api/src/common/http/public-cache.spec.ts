import type { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_CACHE, PublicCacheInterceptor } from './public-cache.interceptor';

function run(result$: () => Observable<unknown>) {
  const headers: Record<string, string> = {};
  const ctx = {
    switchToHttp: () => ({ getResponse: () => ({ setHeader: (k: string, v: string) => (headers[k] = v) }) }),
  } as unknown as ExecutionContext;
  return { headers, out: lastValueFrom(new PublicCacheInterceptor().intercept(ctx, { handle: result$ })) };
}

describe('PublicCacheInterceptor', () => {
  it('успішна відповідь кешується публічно', async () => {
    const { headers, out } = run(() => of({ id: 'p1' }));
    await out;
    expect(headers['Cache-Control']).toBe(PUBLIC_CACHE);
  });

  it('помилка (напр. 404) не кешується', async () => {
    const { headers, out } = run(() => throwError(() => new Error('not found')));
    await expect(out).rejects.toThrow('not found');
    expect(headers['Cache-Control']).toBeUndefined();
  });
});

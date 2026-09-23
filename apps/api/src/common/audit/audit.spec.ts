import { Reflector } from '@nestjs/core';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_KEY, AuditInterceptor, type AuditMeta } from './audit.interceptor';
import { sanitizeAuditData } from './audit.sanitize';

describe('sanitizeAuditData', () => {
  it('приховує секрети на будь-якій глибині', () => {
    expect(
      sanitizeAuditData({ email: 'a@b.ua', password: 'x', nested: { accessToken: 't', card: '4111' }, list: [{ secret: 1 }] }),
    ).toEqual({ email: 'a@b.ua', password: '[приховано]', nested: { accessToken: '[приховано]', card: '[приховано]' }, list: [{ secret: '[приховано]' }] });
  });

  it('обрізає довгі рядки, великі масиви й глибоку вкладеність', () => {
    expect((sanitizeAuditData('я'.repeat(600)) as string).length).toBe(501);
    const arr = sanitizeAuditData(Array.from({ length: 60 }, (_, i) => i)) as unknown[];
    expect(arr).toHaveLength(51);
    expect(arr[50]).toBe('… ще 10');
    expect(sanitizeAuditData({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toEqual({ a: { b: { c: { d: { e: '[…]' } } } } });
    expect(sanitizeAuditData(undefined)).toBeNull();
  });
});

function run(meta: AuditMeta | undefined, req: Record<string, unknown>, result$: CallHandler['handle']) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'get').mockImplementation((key) => (key === AUDIT_KEY ? meta : undefined));
  const audit = { record: vi.fn(async () => undefined) };
  const interceptor = new AuditInterceptor(reflector, audit as unknown as AuditService);
  const ctx = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { audit, out: lastValueFrom(interceptor.intercept(ctx, { handle: result$ })) };
}

describe('AuditInterceptor', () => {
  const req = { user: { sub: 'u1' }, params: { number: 'VS-1' }, body: { status: 'PAID', note: 'ok' }, ip: '10.0.0.1' };

  it('пише запис після успіху: автор, id з параметра маршруту, тіло, IP', async () => {
    const { audit, out } = run({ action: 'order.status', entity: 'Order', idParam: 'number' }, req, () => of({ number: 'VS-1' }));
    await out;
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'order.status',
      entity: 'Order',
      entityId: 'VS-1',
      data: { status: 'PAID', note: 'ok' },
      ip: '10.0.0.1',
    });
  });

  it('без параметра — id з відповіді; порожнє тіло не зберігається', async () => {
    const { audit, out } = run({ action: 'product.create', entity: 'Product' }, { user: { sub: 'u1' }, body: {} }, () => of({ id: 'p9' }));
    await out;
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'p9', data: undefined, ip: null }));
  });

  it('невдала дія не журналюється; маршрут без @Audited — теж', async () => {
    const failed = run({ action: 'x', entity: 'Order' }, req, () => throwError(() => new Error('400')));
    await expect(failed.out).rejects.toThrow('400');
    expect(failed.audit.record).not.toHaveBeenCalled();
    const plain = run(undefined, req, () => of({ id: 'z' }));
    await plain.out;
    expect(plain.audit.record).not.toHaveBeenCalled();
  });
});

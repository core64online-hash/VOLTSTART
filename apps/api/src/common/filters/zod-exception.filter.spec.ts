import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ZodExceptionFilter } from './zod-exception.filter';

describe('ZodExceptionFilter', () => {
  it('перетворює ZodError на 400 з полями та повідомленнями', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;

    const result = z.object({ email: z.string().email('Некоректний email'), qty: z.number() }).safeParse({ email: 'x' });
    if (result.success) throw new Error('очікували помилку валідації');
    new ZodExceptionFilter().catch(result.error, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toContain('email: Некоректний email');
    expect(body.message.some((m: string) => m.startsWith('qty:'))).toBe(true);
  });
});

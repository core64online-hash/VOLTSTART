import { BadGatewayException, BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { WebhookVerification } from './payment-provider.interface';
import { PaymentsService } from './payments.service';

interface FakePayment {
  id: string;
  provider: string;
  amountMinor: number;
  currency: string;
  status: string;
  externalId: string | null;
}

/** Мінімальний фейк Prisma: транзакція виконує колбек на тому ж «сховищі». */
function setup(opts: {
  verification?: WebhookVerification;
  orderStatus?: string;
  payment?: Partial<FakePayment>;
}) {
  const seen = new Set<string>();
  const payment: FakePayment = {
    id: 'p1',
    provider: 'WAYFORPAY',
    amountMinor: 1_899_000,
    currency: 'UAH',
    status: 'PENDING',
    externalId: null,
    ...opts.payment,
  };
  const order = { id: 'o1', number: 'VS-1', status: opts.orderStatus ?? 'PENDING_PAYMENT', payments: [payment] };

  const store = {
    webhookEvent: {
      create: vi.fn(async ({ data }: { data: { provider: string; eventId: string } }) => {
        const key = `${data.provider}:${data.eventId}`;
        if (seen.has(key)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        seen.add(key);
      }),
    },
    order: {
      findUnique: vi.fn(async () => order),
      update: vi.fn(async ({ data }: { data: object }) => Object.assign(order, data)),
    },
    payment: {
      update: vi.fn(async ({ data }: { data: object }) => Object.assign(payment, data)),
    },
  };
  const prisma = { ...store, $transaction: async <T>(fn: (tx: typeof store) => Promise<T>) => fn(store) };

  const provider = {
    kind: payment.provider,
    createPayment: vi.fn(),
    verifyWebhook: vi.fn(async () => opts.verification ?? { valid: false, status: 'PENDING' }),
    webhookAck: vi.fn(() => ({ status: 'accept' })),
  };
  const registry = { get: () => provider, has: () => true };
  const service = new PaymentsService(prisma as never, registry as never);
  return { service, order, payment, provider, store };
}

const approved: WebhookVerification = {
  valid: true,
  eventId: 'VS-1:Approved',
  orderReference: 'VS-1',
  externalId: 'VS-1',
  status: 'SUCCEEDED',
  amountMinor: 1_899_000,
  currency: 'UAH',
};

describe('PaymentsService.handleWebhook', () => {
  it('успішна оплата: платіж SUCCEEDED, замовлення PAID, повертає ack провайдера', async () => {
    const { service, order, payment } = setup({ verification: approved });
    const res = await service.handleWebhook('WAYFORPAY', {}, '{}');
    expect(res).toEqual({ received: true, ack: { status: 'accept' } });
    expect(payment.status).toBe('SUCCEEDED');
    expect(order.status).toBe('PAID');
  });

  it('повторна доставка тієї ж події — ідемпотентно (duplicate), без повторних змін', async () => {
    const { service, store } = setup({ verification: approved });
    await service.handleWebhook('WAYFORPAY', {}, '{}');
    const res = await service.handleWebhook('WAYFORPAY', {}, '{}');
    expect(res.duplicate).toBe(true);
    expect(store.payment.update).toHaveBeenCalledTimes(1);
  });

  it('сума не збігається: платіж FAILED, замовлення не оплачується', async () => {
    const { service, order, payment } = setup({ verification: { ...approved, amountMinor: 100 } });
    const res = await service.handleWebhook('WAYFORPAY', {}, '{}');
    expect(res.mismatch).toBe(true);
    expect(payment.status).toBe('FAILED');
    expect(order.status).toBe('PENDING_PAYMENT');
  });

  it('невалідний підпис — 400', async () => {
    const { service } = setup({ verification: { valid: false, status: 'PENDING' } });
    await expect(service.handleWebhook('WAYFORPAY', {}, '{}')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('подія без orderReference — підтверджується без змін', async () => {
    const { service, store } = setup({ verification: { valid: true, eventId: 'evt', status: 'PENDING' } });
    const res = await service.handleWebhook('WAYFORPAY', {}, '{}');
    expect(res.ignored).toBe(true);
    expect(store.webhookEvent.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.initiate', () => {
  const params = { orderNumber: 'VS-1', description: 'x', returnUrl: 'http://localhost:3000' };

  it('зберігає externalId і повертає інструкцію', async () => {
    const { service, provider, payment } = setup({});
    provider.createPayment.mockResolvedValue({
      externalId: 'cs_1',
      instruction: { provider: 'WAYFORPAY', redirectUrl: 'https://pay' },
    });
    const instruction = await service.initiate(payment as never, params);
    expect(instruction.redirectUrl).toBe('https://pay');
    expect(payment.externalId).toBe('cs_1');
  });

  it('збій провайдера — платіж FAILED і 502', async () => {
    const { service, provider, payment } = setup({});
    provider.createPayment.mockRejectedValue(new Error('network'));
    await expect(service.initiate(payment as never, params)).rejects.toBeInstanceOf(BadGatewayException);
    expect(payment.status).toBe('FAILED');
  });
});

describe('PaymentsService.markInvoicePaid', () => {
  it('позначає рахунок оплаченим і переводить замовлення в PAID; повтор — 409', async () => {
    const { service, order, payment } = setup({ orderStatus: 'INVOICED', payment: { provider: 'BANK_INVOICE' } });
    await expect(service.markInvoicePaid('VS-1')).resolves.toEqual({ orderNumber: 'VS-1', status: 'PAID' });
    expect(payment.status).toBe('SUCCEEDED');
    expect(order.status).toBe('PAID');
    await expect(service.markInvoicePaid('VS-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

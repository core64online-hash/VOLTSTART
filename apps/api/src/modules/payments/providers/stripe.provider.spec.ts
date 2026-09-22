import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { StripeProvider } from './stripe.provider';

const cfg = { secretKey: 'sk_test_123', webhookSecret: 'whsec_abc' };
const NOW = 1_700_000_000;

function sigHeader(rawBody: string, t = NOW, secret = cfg.webhookSecret): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

function event(type: string, object: Record<string, unknown>): string {
  return JSON.stringify({ id: 'evt_1', type, data: { object } });
}

const session = {
  id: 'cs_test_1',
  client_reference_id: 'VS-1',
  amount_total: 49900,
  currency: 'usd',
  payment_status: 'paid',
};

describe('StripeProvider.createPayment', () => {
  it('створює Checkout Session з ідемпотентним ключем і повертає URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    });
    const provider = new StripeProvider(cfg, fetchFn, () => NOW);
    const res = await provider.createPayment({
      orderReference: 'VS-1',
      amountMinor: 49900,
      currency: 'USD',
      description: 'Замовлення VS-1',
      returnUrl: 'http://localhost:3000/en/checkout/result',
    });

    expect(res).toEqual({
      externalId: 'cs_test_1',
      instruction: { provider: 'STRIPE', redirectUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' },
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.headers.authorization).toBe('Bearer sk_test_123');
    expect(init.headers['idempotency-key']).toBe('checkout-VS-1');
    const form = new URLSearchParams(init.body);
    expect(form.get('client_reference_id')).toBe('VS-1');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('49900');
    expect(form.get('line_items[0][price_data][currency]')).toBe('usd');
  });

  it('кидає помилку, якщо Stripe відповів не 2xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) });
    const provider = new StripeProvider(cfg, fetchFn, () => NOW);
    await expect(
      provider.createPayment({
        orderReference: 'VS-1',
        amountMinor: 100,
        currency: 'USD',
        description: 'x',
        returnUrl: 'http://localhost:3000',
      }),
    ).rejects.toThrow(/402/);
  });
});

describe('StripeProvider.verifyWebhook', () => {
  const provider = new StripeProvider(cfg, vi.fn(), () => NOW);

  it('приймає checkout.session.completed (paid) → SUCCEEDED', async () => {
    const raw = event('checkout.session.completed', session);
    const v = await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw) }, raw);
    expect(v).toMatchObject({
      valid: true,
      status: 'SUCCEEDED',
      eventId: 'evt_1',
      orderReference: 'VS-1',
      externalId: 'cs_test_1',
      amountMinor: 49900,
      currency: 'USD',
    });
  });

  it('completed, але ще не оплачено (асинхронний метод) → PENDING', async () => {
    const raw = event('checkout.session.completed', { ...session, payment_status: 'unpaid' });
    const v = await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw) }, raw);
    expect(v.status).toBe('PENDING');
  });

  it('expired → FAILED', async () => {
    const raw = event('checkout.session.expired', session);
    expect((await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw) }, raw)).status).toBe('FAILED');
  });

  it('інші події — валідні, але без orderReference (ігноруються)', async () => {
    const raw = event('customer.created', { id: 'cus_1' });
    const v = await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw) }, raw);
    expect(v.valid).toBe(true);
    expect(v.orderReference).toBeUndefined();
  });

  it('відхиляє невірний підпис і підміну тіла', async () => {
    const raw = event('checkout.session.completed', session);
    expect((await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw, NOW, 'wrong') }, raw)).valid).toBe(false);
    expect((await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw) }, raw + ' ')).valid).toBe(false);
  });

  it('відхиляє застарілий timestamp (replay)', async () => {
    const raw = event('checkout.session.completed', session);
    const v = await provider.verifyWebhook({ 'stripe-signature': sigHeader(raw, NOW - 3600) }, raw);
    expect(v.valid).toBe(false);
  });

  it('відхиляє відсутній заголовок', async () => {
    expect((await provider.verifyWebhook({}, '{}')).valid).toBe(false);
  });
});

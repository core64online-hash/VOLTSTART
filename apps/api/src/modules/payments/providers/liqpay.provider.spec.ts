import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LIQPAY_CHECKOUT_URL, LiqPayProvider } from './liqpay.provider';

const cfg = {
  publicKey: 'sandbox_i000',
  privateKey: 'sandbox_priv',
  serverUrl: 'https://api.voltstar.ua/api/payments/webhooks/LIQPAY',
  sandbox: false,
};

const sign = (data: string) =>
  createHash('sha1').update(cfg.privateKey + data + cfg.privateKey).digest('base64');

function webhookBody(payload: Record<string, unknown>, signature?: string): string {
  const data = Buffer.from(JSON.stringify({ public_key: cfg.publicKey, ...payload })).toString('base64');
  return new URLSearchParams({ data, signature: signature ?? sign(data) }).toString();
}

describe('LiqPayProvider.createPayment', () => {
  it('кодує параметри в data і підписує їх', async () => {
    const provider = new LiqPayProvider(cfg);
    const { instruction } = await provider.createPayment({
      orderReference: 'VS-1',
      amountMinor: 1899050,
      currency: 'UAH',
      description: 'Замовлення VS-1',
      returnUrl: 'http://localhost:3000/uk/checkout/result',
    });
    const { data, signature } = instruction.formFields!;
    expect(instruction.redirectUrl).toBe(LIQPAY_CHECKOUT_URL);
    expect(signature).toBe(sign(data));
    const params = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    expect(params).toMatchObject({
      public_key: cfg.publicKey,
      version: 3,
      action: 'pay',
      amount: 18990.5,
      currency: 'UAH',
      order_id: 'VS-1',
      server_url: cfg.serverUrl,
    });
  });
});

describe('LiqPayProvider.verifyWebhook', () => {
  const provider = new LiqPayProvider(cfg);

  it('приймає success із коректним підписом', async () => {
    const v = await provider.verifyWebhook(
      {},
      webhookBody({ status: 'success', order_id: 'VS-1', payment_id: 777, amount: 18990.5, currency: 'UAH' }),
    );
    expect(v).toMatchObject({
      valid: true,
      status: 'SUCCEEDED',
      orderReference: 'VS-1',
      externalId: '777',
      eventId: '777:success',
      amountMinor: 1899050,
    });
  });

  it('мапить failure → FAILED, reversed → REFUNDED', async () => {
    expect((await provider.verifyWebhook({}, webhookBody({ status: 'failure', order_id: 'VS-1' }))).status).toBe(
      'FAILED',
    );
    expect((await provider.verifyWebhook({}, webhookBody({ status: 'reversed', order_id: 'VS-1' }))).status).toBe(
      'REFUNDED',
    );
  });

  it('статус sandbox — успіх лише в тестовому режимі', async () => {
    const body = webhookBody({ status: 'sandbox', order_id: 'VS-1' });
    expect((await provider.verifyWebhook({}, body)).status).toBe('PENDING');
    expect((await new LiqPayProvider({ ...cfg, sandbox: true }).verifyWebhook({}, body)).status).toBe('SUCCEEDED');
  });

  it('відхиляє невірний підпис', async () => {
    const v = await provider.verifyWebhook({}, webhookBody({ status: 'success' }, 'forged'));
    expect(v.valid).toBe(false);
  });

  it('відхиляє подію чужого public_key', async () => {
    const data = Buffer.from(JSON.stringify({ public_key: 'other', status: 'success' })).toString('base64');
    const v = await provider.verifyWebhook({}, new URLSearchParams({ data, signature: sign(data) }).toString());
    expect(v.valid).toBe(false);
  });
});

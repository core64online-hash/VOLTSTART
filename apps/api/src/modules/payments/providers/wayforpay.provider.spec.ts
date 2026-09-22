import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WayForPayProvider, WAYFORPAY_PAY_URL, wayForPaySignature } from './wayforpay.provider';

const cfg = {
  merchantAccount: 'test_merch',
  merchantSecret: 'secret-key',
  merchantDomain: 'voltstar.ua',
  serviceUrl: 'https://api.voltstar.ua/api/payments/webhooks/WAYFORPAY',
};
const NOW = 1_700_000_000;
const provider = new WayForPayProvider(cfg, () => NOW);

/** Незалежно від реалізації: HMAC-MD5 рядка, зʼєднаного через ";". */
const md5 = (s: string) => createHmac('md5', cfg.merchantSecret).update(s).digest('hex');

function signedWebhook(overrides: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {
    merchantAccount: cfg.merchantAccount,
    orderReference: 'VS-20260922-ABC123',
    amount: 18990,
    currency: 'UAH',
    authCode: '541963',
    cardPan: '41****8217',
    transactionStatus: 'Approved',
    reasonCode: 1100,
    ...overrides,
  };
  body.merchantSignature = md5(
    [
      body.merchantAccount,
      body.orderReference,
      body.amount,
      body.currency,
      body.authCode,
      body.cardPan,
      body.transactionStatus,
      body.reasonCode,
    ].join(';'),
  );
  return body;
}

describe('WayForPayProvider.createPayment', () => {
  it('формує підписану форму оплати', async () => {
    const { instruction } = await provider.createPayment({
      orderReference: 'VS-1',
      amountMinor: 1899000,
      currency: 'UAH',
      description: 'Замовлення VS-1',
      returnUrl: 'http://localhost:3000/uk/checkout/result',
      customerEmail: 'a@b.ua',
    });
    const f = instruction.formFields!;
    expect(instruction.redirectUrl).toBe(WAYFORPAY_PAY_URL);
    expect(f.amount).toBe('18990.00');
    expect(f.orderDate).toBe(String(NOW));
    expect(f.serviceUrl).toBe(cfg.serviceUrl);
    expect(f.clientEmail).toBe('a@b.ua');
    expect(f.merchantSignature).toBe(
      md5(`test_merch;voltstar.ua;VS-1;${NOW};18990.00;UAH;Замовлення VS-1;1;18990.00`),
    );
  });
});

describe('WayForPayProvider.verifyWebhook', () => {
  it('приймає коректно підписаний вебхук і мапить Approved → SUCCEEDED', async () => {
    const v = await provider.verifyWebhook({}, JSON.stringify(signedWebhook()));
    expect(v).toMatchObject({
      valid: true,
      status: 'SUCCEEDED',
      orderReference: 'VS-20260922-ABC123',
      eventId: 'VS-20260922-ABC123:Approved',
      amountMinor: 1899000,
      currency: 'UAH',
    });
  });

  it('мапить Declined → FAILED, Refunded → REFUNDED', async () => {
    const declined = await provider.verifyWebhook({}, JSON.stringify(signedWebhook({ transactionStatus: 'Declined' })));
    const refunded = await provider.verifyWebhook({}, JSON.stringify(signedWebhook({ transactionStatus: 'Refunded' })));
    expect(declined.status).toBe('FAILED');
    expect(refunded.status).toBe('REFUNDED');
  });

  it('відхиляє підроблену суму', async () => {
    const body = signedWebhook();
    body.amount = 1;
    const v = await provider.verifyWebhook({}, JSON.stringify(body));
    expect(v.valid).toBe(false);
  });

  it('відхиляє вебхук іншого мерчанта', async () => {
    const v = await provider.verifyWebhook({}, JSON.stringify(signedWebhook({ merchantAccount: 'other' })));
    expect(v.valid).toBe(false);
  });

  it('розбирає JSON, надісланий як ключ form-urlencoded', async () => {
    const raw = encodeURIComponent(JSON.stringify(signedWebhook()));
    const v = await provider.verifyWebhook({}, raw);
    expect(v.valid).toBe(true);
  });

  it('відхиляє не-JSON тіло', async () => {
    expect((await provider.verifyWebhook({}, 'garbage')).valid).toBe(false);
  });
});

describe('WayForPayProvider.webhookAck', () => {
  it('підписує підтвердження accept', () => {
    const ack = provider.webhookAck({ valid: true, status: 'SUCCEEDED', orderReference: 'VS-1' }) as Record<
      string,
      unknown
    >;
    expect(ack).toEqual({
      orderReference: 'VS-1',
      status: 'accept',
      time: NOW,
      signature: wayForPaySignature(cfg.merchantSecret, ['VS-1', 'accept', NOW]),
    });
  });
});

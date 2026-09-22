import { describe, expect, it } from 'vitest';
import { BankInvoiceProvider } from './bank-invoice.provider';
import { buildProviders } from './index';

describe('buildProviders', () => {
  it('без облікових даних — жодного провайдера', () => {
    expect(buildProviders(() => undefined)).toEqual([]);
  });

  it('створює лише налаштовані провайдери з URL вебхуків', () => {
    const env: Record<string, string> = {
      API_PUBLIC_URL: 'https://api.voltstar.ua/',
      WAYFORPAY_MERCHANT_ACCOUNT: 'm',
      WAYFORPAY_MERCHANT_SECRET: 's',
      STRIPE_SECRET_KEY: 'sk',
      // STRIPE_WEBHOOK_SECRET відсутній — Stripe не має зʼявитися
      INVOICE_IBAN: 'UA213223130000026007233566001',
    };
    const kinds = buildProviders((k) => env[k]).map((p) => p.kind);
    expect(kinds).toEqual(['WAYFORPAY', 'BANK_INVOICE']);
  });
});

describe('BankInvoiceProvider', () => {
  const provider = new BankInvoiceProvider({
    recipient: 'ТОВ «ВОЛЬТСТАР»',
    recipientEdrpou: '14360570',
    iban: 'UA213223130000026007233566001',
  });

  it('видає реквізити рахунку на суму замовлення', async () => {
    const res = await provider.createPayment({
      orderReference: 'VS-9',
      amountMinor: 5_000_000,
      currency: 'UAH',
      description: 'x',
      returnUrl: 'http://localhost:3000',
    });
    expect(res.externalId).toBe('VS-9');
    expect(res.instruction.invoice).toMatchObject({
      iban: 'UA213223130000026007233566001',
      recipientEdrpou: '14360570',
      amountMinor: 5_000_000,
      currency: 'UAH',
    });
    expect(res.instruction.invoice?.purpose).toContain('VS-9');
  });

  it('не приймає вебхуків (звірка вручну)', async () => {
    expect((await provider.verifyWebhook()).valid).toBe(false);
  });
});

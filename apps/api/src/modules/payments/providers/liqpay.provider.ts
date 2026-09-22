import { createHash } from 'node:crypto';
import type { Currency } from '@voltstar/types';
import {
  formatMajor,
  toMinor,
  type CreatePaymentParams,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentStatusValue,
  type WebhookVerification,
} from '../payment-provider.interface';
import { parseJsonObject, safeEqual, str } from './crypto.util';

export const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

export interface LiqPayConfig {
  publicKey: string;
  privateKey: string;
  /** URL нашого вебхука (server_url). */
  serverUrl: string;
  /** Приймати статус "sandbox" як успішний (лише для тестового режиму). */
  sandbox: boolean;
}

/** Підпис LiqPay: base64(sha1(private_key + data + private_key)). */
export function liqPaySignature(privateKey: string, data: string): string {
  return createHash('sha1').update(privateKey + data + privateKey, 'utf8').digest('base64');
}

export class LiqPayProvider implements PaymentProvider {
  readonly kind = 'LIQPAY' as const;

  constructor(private readonly cfg: LiqPayConfig) {}

  async createPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
    const params = {
      public_key: this.cfg.publicKey,
      version: 3,
      action: 'pay',
      amount: Number(formatMajor(p.amountMinor)),
      currency: p.currency,
      description: p.description,
      order_id: p.orderReference,
      result_url: p.returnUrl,
      server_url: this.cfg.serverUrl,
      language: 'uk',
    };
    const data = Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
    return {
      instruction: {
        provider: this.kind,
        redirectUrl: LIQPAY_CHECKOUT_URL,
        formFields: { data, signature: liqPaySignature(this.cfg.privateKey, data) },
      },
    };
  }

  async verifyWebhook(_headers: Record<string, string>, rawBody: string): Promise<WebhookVerification> {
    const form = new URLSearchParams(rawBody);
    const data = form.get('data') ?? '';
    const signature = form.get('signature') ?? '';
    if (!data || !safeEqual(liqPaySignature(this.cfg.privateKey, data), signature)) {
      return { valid: false, status: 'PENDING' };
    }

    const body = parseJsonObject(Buffer.from(data, 'base64').toString('utf8'));
    if (!body || str(body.public_key) !== this.cfg.publicKey) {
      return { valid: false, status: 'PENDING' };
    }

    const status = str(body.status);
    return {
      valid: true,
      eventId: `${str(body.payment_id)}:${status}`,
      orderReference: str(body.order_id) || undefined,
      externalId: str(body.payment_id) || undefined,
      status: this.mapStatus(status),
      amountMinor: toMinor(Number(body.amount)),
      currency: str(body.currency) as Currency,
    };
  }

  private mapStatus(status: string): PaymentStatusValue {
    if (status === 'success') return 'SUCCEEDED';
    if (status === 'sandbox') return this.cfg.sandbox ? 'SUCCEEDED' : 'PENDING';
    if (status === 'failure' || status === 'error') return 'FAILED';
    if (status === 'reversed') return 'REFUNDED';
    return 'PENDING';
  }
}

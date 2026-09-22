import { createHmac } from 'node:crypto';
import type { Currency } from '@voltstar/types';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  WebhookVerification,
} from '../payment-provider.interface';
import { parseJsonObject, safeEqual, str } from './crypto.util';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiBase?: string;
  /** Допустиме відхилення часу підпису вебхука, с. */
  toleranceSec?: number;
}

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Підпис Stripe-Signature (v1): HMAC-SHA256 від "{timestamp}.{rawBody}". */
export function stripeSignature(secret: string, timestamp: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

export class StripeProvider implements PaymentProvider {
  readonly kind = 'STRIPE' as const;

  constructor(
    private readonly cfg: StripeConfig,
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
    private readonly nowSec: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  /** Створює Stripe Checkout Session і повертає її hosted URL. */
  async createPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
    const form = new URLSearchParams({
      mode: 'payment',
      success_url: p.returnUrl,
      cancel_url: p.returnUrl,
      client_reference_id: p.orderReference,
      'metadata[orderReference]': p.orderReference,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': p.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(p.amountMinor),
      'line_items[0][price_data][product_data][name]': p.description,
    });
    if (p.customerEmail) form.set('customer_email', p.customerEmail);

    const res = await this.fetchFn(`${this.cfg.apiBase ?? 'https://api.stripe.com'}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.cfg.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        // Повторний виклик для того ж замовлення не створить другу сесію.
        'idempotency-key': `checkout-${p.orderReference}`,
      },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`Stripe checkout session failed: ${res.status}`);

    const session = (await res.json()) as { id?: string; url?: string };
    if (!session.id || !session.url) throw new Error('Stripe checkout session: порожня відповідь');
    return { instruction: { provider: this.kind, redirectUrl: session.url }, externalId: session.id };
  }

  async verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<WebhookVerification> {
    if (!this.signatureValid(headers['stripe-signature'] ?? '', rawBody)) {
      return { valid: false, status: 'PENDING' };
    }
    const event = parseJsonObject(rawBody);
    if (!event) return { valid: false, status: 'PENDING' };

    const type = str(event.type);
    const object = ((event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {}) as Record<
      string,
      unknown
    >;
    const base = {
      valid: true,
      eventId: str(event.id),
      orderReference: str(object.client_reference_id) || undefined,
      externalId: str(object.id) || undefined,
      amountMinor: typeof object.amount_total === 'number' ? object.amount_total : undefined,
      currency: object.currency ? (str(object.currency).toUpperCase() as Currency) : undefined,
    };

    switch (type) {
      case 'checkout.session.completed':
        // Для асинхронних методів оплати сесія завершується ще до списання.
        return { ...base, status: object.payment_status === 'paid' ? 'SUCCEEDED' : 'PENDING' };
      case 'checkout.session.async_payment_succeeded':
        return { ...base, status: 'SUCCEEDED' };
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        return { ...base, status: 'FAILED' };
      default:
        // Інші події не стосуються сесій checkout — підтверджуємо без дій.
        return { valid: true, eventId: base.eventId, status: 'PENDING' };
    }
  }

  /** Заголовок "t=...,v1=...[,v1=...]"; перевіряємо підпис і вікно часу. */
  private signatureValid(header: string, rawBody: string): boolean {
    const parts = header.split(',').map((kv) => kv.trim().split('='));
    const t = Number(parts.find(([k]) => k === 't')?.[1]);
    const candidates = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
    if (!Number.isFinite(t) || candidates.length === 0) return false;
    if (Math.abs(this.nowSec() - t) > (this.cfg.toleranceSec ?? 300)) return false;

    const expected = stripeSignature(this.cfg.webhookSecret, t, rawBody);
    return candidates.some((c) => safeEqual(expected, c));
  }
}

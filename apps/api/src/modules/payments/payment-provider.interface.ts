import type { Currency, PaymentInstruction, PaymentProviderKind } from '@voltstar/types';

export type PaymentStatusValue = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface CreatePaymentParams {
  /** Номер замовлення — використовується як reference у провайдера. */
  orderReference: string;
  amountMinor: number;
  currency: Currency;
  description: string;
  returnUrl: string;
  customerEmail?: string;
}

export interface CreatePaymentResult {
  instruction: PaymentInstruction;
  /** Id платежу/сесії у провайдера, якщо відомий одразу. */
  externalId?: string;
}

export interface WebhookVerification {
  /** Підпис валідний і тіло розібране. */
  valid: boolean;
  /** Унікальний id події — ключ ідемпотентності. */
  eventId?: string;
  /** Номер замовлення, до якого належить подія (відсутній — подію ігноруємо). */
  orderReference?: string;
  externalId?: string;
  status: PaymentStatusValue;
  /** Сума й валюта з вебхука — для звірки з очікуваним платежем. */
  amountMinor?: number;
  currency?: Currency;
}

/**
 * Спільний контракт платіжного провайдера.
 * Реалізації: WayForPay, LiqPay, Stripe, BankInvoice (оплата за рахунком).
 */
export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  /** Перевірка підпису вебхука та витяг статусу. */
  verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<WebhookVerification>;
  /** Тіло відповіді на вебхук, якщо провайдер його вимагає (WayForPay). */
  webhookAck?(verification: WebhookVerification): unknown;
}

/** Перетворює суму з мінімальних одиниць у рядок "1234.50". */
export function formatMajor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

/** Перетворює суму в основних одиницях у мінімальні (з округленням). */
export function toMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

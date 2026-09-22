import type { Currency, PaymentProviderKind } from '@voltstar/types';

export interface CreatePaymentParams {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: Currency;
  description: string;
  returnUrl: string;
}

export interface CreatePaymentResult {
  /** URL сторінки оплати провайдера (hosted checkout). */
  redirectUrl?: string;
  /** Дані для форми/віджета, якщо потрібні. */
  payload?: Record<string, unknown>;
  externalId?: string;
}

export interface WebhookVerification {
  valid: boolean;
  externalId?: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
}

/**
 * Спільний контракт платіжного провайдера.
 * Реалізації (Phase 3): WayForPayProvider, LiqPayProvider, StripeProvider, BankInvoiceProvider.
 */
export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  /** Перевірка підпису вебхука та витяг статусу (ідемпотентно). */
  verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<WebhookVerification>;
}

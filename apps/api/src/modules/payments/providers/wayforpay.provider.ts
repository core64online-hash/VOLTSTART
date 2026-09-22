import { createHmac } from 'node:crypto';
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

export const WAYFORPAY_PAY_URL = 'https://secure.wayforpay.com/pay';

export interface WayForPayConfig {
  merchantAccount: string;
  merchantSecret: string;
  merchantDomain: string;
  /** URL нашого вебхука (serviceUrl). */
  serviceUrl: string;
}

/** Підпис WayForPay: HMAC-MD5 від полів, зʼєднаних через ";". */
export function wayForPaySignature(secret: string, parts: Array<string | number>): string {
  return createHmac('md5', secret).update(parts.join(';'), 'utf8').digest('hex');
}

const STATUS_MAP: Record<string, PaymentStatusValue> = {
  Approved: 'SUCCEEDED',
  Declined: 'FAILED',
  Expired: 'FAILED',
  Refunded: 'REFUNDED',
  Voided: 'REFUNDED',
};

export class WayForPayProvider implements PaymentProvider {
  readonly kind = 'WAYFORPAY' as const;

  constructor(
    private readonly cfg: WayForPayConfig,
    private readonly nowSec: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  async createPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
    const orderDate = this.nowSec();
    const amount = formatMajor(p.amountMinor);
    const signature = wayForPaySignature(this.cfg.merchantSecret, [
      this.cfg.merchantAccount,
      this.cfg.merchantDomain,
      p.orderReference,
      orderDate,
      amount,
      p.currency,
      p.description,
      1,
      amount,
    ]);

    const formFields: Record<string, string> = {
      merchantAccount: this.cfg.merchantAccount,
      merchantDomainName: this.cfg.merchantDomain,
      merchantTransactionSecureType: 'AUTO',
      merchantSignature: signature,
      orderReference: p.orderReference,
      orderDate: String(orderDate),
      amount,
      currency: p.currency,
      'productName[]': p.description,
      'productCount[]': '1',
      'productPrice[]': amount,
      returnUrl: p.returnUrl,
      serviceUrl: this.cfg.serviceUrl,
      language: 'UA',
    };
    if (p.customerEmail) formFields.clientEmail = p.customerEmail;

    return {
      instruction: { provider: this.kind, redirectUrl: WAYFORPAY_PAY_URL, formFields },
    };
  }

  async verifyWebhook(_headers: Record<string, string>, rawBody: string): Promise<WebhookVerification> {
    const body = parseBody(rawBody);
    if (!body) return { valid: false, status: 'PENDING' };

    const expected = wayForPaySignature(this.cfg.merchantSecret, [
      str(body.merchantAccount),
      str(body.orderReference),
      str(body.amount),
      str(body.currency),
      str(body.authCode),
      str(body.cardPan),
      str(body.transactionStatus),
      str(body.reasonCode),
    ]);
    if (
      str(body.merchantAccount) !== this.cfg.merchantAccount ||
      !safeEqual(expected, str(body.merchantSignature))
    ) {
      return { valid: false, status: 'PENDING' };
    }

    const transactionStatus = str(body.transactionStatus);
    const orderReference = str(body.orderReference);
    return {
      valid: true,
      eventId: `${orderReference}:${transactionStatus}`,
      orderReference,
      externalId: orderReference,
      status: STATUS_MAP[transactionStatus] ?? 'PENDING',
      amountMinor: toMinor(Number(body.amount)),
      currency: str(body.currency) as Currency,
    };
  }

  /** WayForPay чекає підписане підтвердження, інакше повторює вебхук. */
  webhookAck(v: WebhookVerification): unknown {
    const time = this.nowSec();
    const orderReference = v.orderReference ?? '';
    return {
      orderReference,
      status: 'accept',
      time,
      signature: wayForPaySignature(this.cfg.merchantSecret, [orderReference, 'accept', time]),
    };
  }
}

/** WayForPay надсилає JSON; інколи — як єдиний ключ form-urlencoded тіла. */
function parseBody(raw: string): Record<string, unknown> | null {
  const direct = parseJsonObject(raw);
  if (direct) return direct;
  const firstKey = [...new URLSearchParams(raw).keys()][0];
  return firstKey ? parseJsonObject(firstKey) : null;
}

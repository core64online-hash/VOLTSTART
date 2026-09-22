import { randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type {
  CheckoutFlow,
  Currency,
  OrderStatus,
  PaymentProviderKind,
  Segment,
} from '@voltstar/types';

/** Гілка оплати за сегментом: B2C — картка онлайн, B2B/B2G — рахунок. */
export function resolveFlow(segment: Segment): CheckoutFlow {
  return segment === 'B2C' ? 'CARD' : 'INVOICE';
}

/**
 * Вибір провайдера з урахуванням гілки, валюти та побажання покупця.
 * UAH — WayForPay (за замовчуванням) або LiqPay; інші валюти — Stripe.
 */
export function chooseProvider(
  flow: CheckoutFlow,
  currency: Currency,
  requested?: PaymentProviderKind,
): PaymentProviderKind {
  if (flow === 'INVOICE') {
    if (requested && requested !== 'BANK_INVOICE') {
      throw new BadRequestException('Для B2B/B2G доступна лише оплата за рахунком');
    }
    return 'BANK_INVOICE';
  }

  if (requested === 'BANK_INVOICE') {
    throw new BadRequestException('Оплата за рахунком доступна лише для B2B/B2G');
  }
  if (currency === 'UAH') return requested ?? 'WAYFORPAY';
  if (requested && requested !== 'STRIPE') {
    throw new BadRequestException('Оплата не в гривнях доступна лише через Stripe');
  }
  return 'STRIPE';
}

/** Початковий статус замовлення за гілкою. */
export function initialOrderStatus(flow: CheckoutFlow): OrderStatus {
  return flow === 'CARD' ? 'PENDING_PAYMENT' : 'INVOICED';
}

/** Номер замовлення: VS-YYYYMMDD-XXXXXX (6 hex-символів випадковості). */
export function generateOrderNumber(now: Date = new Date(), random: () => string = () => randomBytes(3).toString('hex')): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `VS-${y}${m}${d}-${random().toUpperCase()}`;
}

/** returnUrl має вести на наш фронтенд — інакше це відкритий редирект. */
export function assertReturnUrlAllowed(returnUrl: string, allowedOrigins: string[]): void {
  let origin: string;
  try {
    origin = new URL(returnUrl).origin;
  } catch {
    throw new BadRequestException('Некоректний returnUrl');
  }
  if (!allowedOrigins.includes(origin)) throw new BadRequestException('returnUrl не дозволений');
}

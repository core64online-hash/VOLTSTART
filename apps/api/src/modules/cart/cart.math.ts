import { BadRequestException } from '@nestjs/common';
import type { CartTotals, Currency, DeliveryMethod } from '@voltstar/types';
import { splitGross } from '../pricing/pricing.math';

/** Тарифи доставки (UAH, мінімальні одиниці, з ПДВ). */
export const DELIVERY_RULES: Record<DeliveryMethod, { feeMinor: number; freeFromMinor: number | null }> = {
  PICKUP: { feeMinor: 0, freeFromMinor: null },
  NOVA_POSHTA: { feeMinor: 15_000, freeFromMinor: 1_000_000 }, // 150 грн, безкоштовно від 10 000 грн
  COURIER: { feeMinor: 40_000, freeFromMinor: 3_000_000 }, // 400 грн, безкоштовно від 30 000 грн
};

export const DELIVERY_VAT_RATE = 0.2;

/**
 * Тарифи задані в гривнях, тож для кошиків в іншій валюті доступний лише самовивіз
 * (міжнародну доставку розраховує менеджер окремо).
 */
export function assertDeliveryAllowed(currency: Currency, method: DeliveryMethod): void {
  if (currency !== 'UAH' && method !== 'PICKUP') {
    throw new BadRequestException('Для оплати не в гривнях доступний лише самовивіз');
  }
}

/** Вартість доставки для суми товарів (з ПДВ). Порожній кошик — 0. */
export function deliveryFee(method: DeliveryMethod, itemsGrossMinor: number): number {
  const rule = DELIVERY_RULES[method];
  if (itemsGrossMinor <= 0) return 0;
  if (rule.freeFromMinor != null && itemsGrossMinor >= rule.freeFromMinor) return 0;
  return rule.feeMinor;
}

export interface PricedLine {
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
}

/** Підсумки кошика: товари + доставка, нетто/ПДВ/брутто. */
export function computeTotals(lines: PricedLine[], method: DeliveryMethod): CartTotals {
  const items = lines.reduce(
    (acc, l) => ({
      net: acc.net + l.netMinor,
      vat: acc.vat + l.vatMinor,
      gross: acc.gross + l.grossMinor,
    }),
    { net: 0, vat: 0, gross: 0 },
  );

  const deliveryMinor = deliveryFee(method, items.gross);
  const delivery = splitGross({ unitGrossMinor: deliveryMinor, vatRate: DELIVERY_VAT_RATE, quantity: 1 });

  return {
    itemsGrossMinor: items.gross,
    deliveryMinor,
    netMinor: items.net + delivery.netMinor,
    vatMinor: items.vat + delivery.vatMinor,
    grossMinor: items.gross + delivery.grossMinor,
  };
}

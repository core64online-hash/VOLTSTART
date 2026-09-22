import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { splitGross } from '../pricing/pricing.math';
import { assertDeliveryAllowed, computeTotals, deliveryFee } from './cart.math';

const line = (unitGrossMinor: number, quantity = 1) => splitGross({ unitGrossMinor, vatRate: 0.2, quantity });

describe('deliveryFee', () => {
  it('самовивіз — безкоштовно', () => {
    expect(deliveryFee('PICKUP', 500_000)).toBe(0);
  });

  it('Нова пошта: 150 грн до порогу, безкоштовно від 10 000 грн', () => {
    expect(deliveryFee('NOVA_POSHTA', 999_999)).toBe(15_000);
    expect(deliveryFee('NOVA_POSHTA', 1_000_000)).toBe(0);
  });

  it('курʼєр: 400 грн до порогу 30 000 грн', () => {
    expect(deliveryFee('COURIER', 2_999_999)).toBe(40_000);
    expect(deliveryFee('COURIER', 3_000_000)).toBe(0);
  });

  it('порожній кошик — без доставки', () => {
    expect(deliveryFee('COURIER', 0)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('сумує позиції й додає доставку з ПДВ', () => {
    const totals = computeTotals([line(12_000, 2), line(6_000)], 'NOVA_POSHTA');
    // товари: 30 000 брутто (25 000 + 5 000 ПДВ); доставка 15 000 (12 500 + 2 500 ПДВ)
    expect(totals).toEqual({
      itemsGrossMinor: 30_000,
      deliveryMinor: 15_000,
      netMinor: 37_500,
      vatMinor: 7_500,
      grossMinor: 45_000,
    });
  });

  it('нетто + ПДВ завжди = брутто (з округленням)', () => {
    const t = computeTotals([line(10_000), line(3_333, 3)], 'COURIER');
    expect(t.netMinor + t.vatMinor).toBe(t.grossMinor);
  });

  it('безкоштовна доставка понад поріг', () => {
    const t = computeTotals([line(1_899_000)], 'NOVA_POSHTA');
    expect(t.deliveryMinor).toBe(0);
    expect(t.grossMinor).toBe(1_899_000);
  });
});

describe('assertDeliveryAllowed', () => {
  it('для UAH — будь-який спосіб', () => {
    expect(() => assertDeliveryAllowed('UAH', 'COURIER')).not.toThrow();
  });

  it('для інших валют — лише самовивіз', () => {
    expect(() => assertDeliveryAllowed('USD', 'PICKUP')).not.toThrow();
    expect(() => assertDeliveryAllowed('EUR', 'NOVA_POSHTA')).toThrow(BadRequestException);
  });
});

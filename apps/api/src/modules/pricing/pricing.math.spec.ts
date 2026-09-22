import { describe, expect, it } from 'vitest';
import { splitGross } from './pricing.math';

describe('splitGross', () => {
  it('виділяє ПДВ 20% із брутто (кратна сума)', () => {
    const r = splitGross({ unitGrossMinor: 12000, vatRate: 0.2, quantity: 1 });
    expect(r.grossMinor).toBe(12000);
    expect(r.netMinor).toBe(10000);
    expect(r.vatMinor).toBe(2000);
  });

  it('множить на кількість', () => {
    const r = splitGross({ unitGrossMinor: 12000, vatRate: 0.2, quantity: 3 });
    expect(r.grossMinor).toBe(36000);
    expect(r.netMinor).toBe(30000);
    expect(r.vatMinor).toBe(6000);
  });

  it('коректно округлює нетто; нетто + ПДВ = брутто', () => {
    const r = splitGross({ unitGrossMinor: 10000, vatRate: 0.2, quantity: 1 });
    expect(r.grossMinor).toBe(10000);
    expect(r.netMinor).toBe(8333); // round(10000 / 1.2)
    expect(r.vatMinor).toBe(1667);
    expect(r.netMinor + r.vatMinor).toBe(r.grossMinor);
  });

  it('нульова ставка ПДВ: нетто = брутто', () => {
    const r = splitGross({ unitGrossMinor: 5000, vatRate: 0, quantity: 2 });
    expect(r.netMinor).toBe(10000);
    expect(r.vatMinor).toBe(0);
    expect(r.grossMinor).toBe(10000);
  });
});

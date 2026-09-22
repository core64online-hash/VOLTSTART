import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertManualTransition, MANUAL_TRANSITIONS, releasesStock } from './order-state';
import { canView } from './orders.service';

describe('assertManualTransition', () => {
  it('дозволяє основний шлях виконання', () => {
    expect(() => assertManualTransition('PAID', 'PROCESSING')).not.toThrow();
    expect(() => assertManualTransition('PROCESSING', 'SHIPPED')).not.toThrow();
    expect(() => assertManualTransition('SHIPPED', 'DELIVERED')).not.toThrow();
  });

  it('скасування — лише до оплати; оплачене — тільки повернення коштів', () => {
    expect(() => assertManualTransition('PENDING_PAYMENT', 'CANCELLED')).not.toThrow();
    expect(() => assertManualTransition('INVOICED', 'CANCELLED')).not.toThrow();
    expect(() => assertManualTransition('PAID', 'CANCELLED')).toThrow(BadRequestException);
    expect(() => assertManualTransition('PAID', 'REFUNDED')).not.toThrow();
  });

  it('менеджер не може «оплатити» вручну чи перескочити етапи', () => {
    expect(() => assertManualTransition('PENDING_PAYMENT', 'PAID')).toThrow(BadRequestException);
    expect(() => assertManualTransition('PAID', 'DELIVERED')).toThrow(BadRequestException);
    expect(() => assertManualTransition('DELIVERED', 'SHIPPED')).toThrow(BadRequestException);
  });

  it('фінальні статуси не мають виходів', () => {
    expect(MANUAL_TRANSITIONS.CANCELLED).toEqual([]);
    expect(MANUAL_TRANSITIONS.REFUNDED).toEqual([]);
  });
});

describe('releasesStock', () => {
  it('скасування і повернення до відвантаження звільняють резерв', () => {
    expect(releasesStock('INVOICED', 'CANCELLED')).toBe(true);
    expect(releasesStock('PAID', 'REFUNDED')).toBe(true);
    expect(releasesStock('PROCESSING', 'REFUNDED')).toBe(true);
  });

  it('повернення після доставки та звичайні кроки — ні', () => {
    expect(releasesStock('DELIVERED', 'REFUNDED')).toBe(false);
    expect(releasesStock('PAID', 'PROCESSING')).toBe(false);
  });
});

describe('canView', () => {
  const order = { userId: 'u1', contactEmail: 'Buyer@Test.ua' };

  it('власник, менеджер і адмін бачать замовлення', () => {
    expect(canView(order, { userId: 'u1', role: 'CUSTOMER' })).toBe(true);
    expect(canView(order, { userId: 'm', role: 'MANAGER' })).toBe(true);
    expect(canView(order, { userId: 'a', role: 'ADMIN' })).toBe(true);
  });

  it('гість — лише з email замовлення (без урахування регістру)', () => {
    expect(canView(order, { email: 'buyer@test.ua' })).toBe(true);
    expect(canView(order, { email: 'other@test.ua' })).toBe(false);
    expect(canView(order, {})).toBe(false);
  });

  it('інший покупець не бачить чужого замовлення', () => {
    expect(canView(order, { userId: 'u2', role: 'CUSTOMER' })).toBe(false);
    expect(canView({ userId: null, contactEmail: null }, { userId: 'u2', role: 'CUSTOMER' })).toBe(false);
  });
});

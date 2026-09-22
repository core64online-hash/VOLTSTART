import { describe, expect, it } from 'vitest';
import { nextOrderStatus } from './order-status';

describe('nextOrderStatus', () => {
  it('успішна оплата переводить очікуюче замовлення в PAID', () => {
    expect(nextOrderStatus('PENDING_PAYMENT', 'SUCCEEDED')).toBe('PAID');
    expect(nextOrderStatus('INVOICED', 'SUCCEEDED')).toBe('PAID');
  });

  it('повторний успіх не змінює вже оплачене чи відвантажене замовлення', () => {
    expect(nextOrderStatus('PAID', 'SUCCEEDED')).toBe('PAID');
    expect(nextOrderStatus('SHIPPED', 'SUCCEEDED')).toBe('SHIPPED');
  });

  it('оплата скасованого замовлення лишає його CANCELLED', () => {
    expect(nextOrderStatus('CANCELLED', 'SUCCEEDED')).toBe('CANCELLED');
  });

  it('невдала оплата не змінює статус (можна повторити)', () => {
    expect(nextOrderStatus('PENDING_PAYMENT', 'FAILED')).toBe('PENDING_PAYMENT');
  });

  it('повернення коштів — лише для оплачених замовлень', () => {
    expect(nextOrderStatus('PAID', 'REFUNDED')).toBe('REFUNDED');
    expect(nextOrderStatus('DELIVERED', 'REFUNDED')).toBe('REFUNDED');
    expect(nextOrderStatus('PENDING_PAYMENT', 'REFUNDED')).toBe('PENDING_PAYMENT');
  });
});

import type { OrderStatus } from '@voltstar/types';
import type { PaymentStatusValue } from './payment-provider.interface';

const AWAITING_PAYMENT: OrderStatus[] = ['DRAFT', 'PENDING_PAYMENT', 'INVOICED'];
const REFUNDABLE: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/**
 * Перехід статусу замовлення за подією платежу.
 * Невідповідні переходи ігноруються (напр., оплата скасованого замовлення
 * лишає його CANCELLED — таку ситуацію розбирає менеджер).
 */
export function nextOrderStatus(current: OrderStatus, payment: PaymentStatusValue): OrderStatus {
  switch (payment) {
    case 'SUCCEEDED':
      return AWAITING_PAYMENT.includes(current) ? 'PAID' : current;
    case 'REFUNDED':
      return REFUNDABLE.includes(current) ? 'REFUNDED' : current;
    default:
      // FAILED/PENDING не змінюють замовлення: покупець може повторити оплату.
      return current;
  }
}

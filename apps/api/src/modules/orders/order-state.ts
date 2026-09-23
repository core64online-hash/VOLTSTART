import { BadRequestException } from '@nestjs/common';
import { MANUAL_ORDER_TRANSITIONS, type OrderStatus } from '@voltstar/types';

/** Ручні переходи менеджера — спільна таблиця з web (@voltstar/types). */
export const MANUAL_TRANSITIONS = MANUAL_ORDER_TRANSITIONS;

export function assertManualTransition(from: OrderStatus, to: OrderStatus): void {
  if (!MANUAL_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Перехід ${from} → ${to} недоступний`);
  }
}

/**
 * Чи повертати товар на склад при переході. Скасування неоплаченого замовлення
 * або повернення коштів до відвантаження звільняють резерв; після відвантаження
 * товар у клієнта — повернення на склад оформлюється окремо.
 */
export function releasesStock(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'CANCELLED') return true;
  if (to === 'REFUNDED') return from === 'PAID' || from === 'PROCESSING';
  return false;
}

/** Статуси, на яких доступна видаткова накладна (товар комплектується / відвантажений). */
export const DELIVERY_NOTE_STATUSES: OrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED'];

/** Статуси, про перехід у які повідомляємо покупця листом. */
export const CUSTOMER_NOTIFIED_STATUSES: OrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

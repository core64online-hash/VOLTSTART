import type { OrderStatus, Prisma } from '@prisma/client';

/** Мінімальний клієнт, достатній для запису події (PrismaService або транзакція). */
type EventWriter = { orderStatusEvent: Pick<Prisma.OrderStatusEventDelegate, 'create'> };

/**
 * Записує перехід статусу в журнал замовлення. Викликається в тій самій транзакції,
 * що й зміна статусу, тож журнал не розходиться з фактичним станом.
 */
export async function logStatusChange(
  db: EventWriter,
  e: { orderId: string; from: OrderStatus | null; to: OrderStatus; actor: string; note?: string | null },
): Promise<void> {
  await db.orderStatusEvent.create({
    data: { orderId: e.orderId, fromStatus: e.from, toStatus: e.to, actor: e.actor, note: e.note ?? null },
  });
}

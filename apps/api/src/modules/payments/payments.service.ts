import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Payment } from '@prisma/client';
import type { OrderStatus, PaymentInstruction, PaymentProviderKind } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { logStatusChange } from '../orders/order-events';
import { nextOrderStatus } from './order-status';
import type { PaymentStatusValue, WebhookVerification } from './payment-provider.interface';
import { PaymentProviderRegistry } from './payment-provider.registry';

export interface InitiateParams {
  orderNumber: string;
  description: string;
  returnUrl: string;
  customerEmail?: string;
}

export interface WebhookOutcome {
  received: true;
  /** Подію вже оброблено раніше (повторна доставка). */
  duplicate?: boolean;
  /** Подія не стосується жодного платежу — підтверджено без дій. */
  ignored?: boolean;
  /** Сума/валюта не збіглися з очікуваними — платіж відхилено. */
  mismatch?: boolean;
  /** Тіло відповіді, якого вимагає провайдер. */
  ack?: unknown;
}

const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentProviderRegistry,
    private readonly notifications: NotificationsService,
  ) {}

  /** Кидає 503, якщо провайдер не налаштований — перевіряється до створення замовлення. */
  assertAvailable(kind: PaymentProviderKind): void {
    this.registry.get(kind);
  }

  /**
   * Ініціює оплату в провайдера для вже створеного (PENDING) платежу.
   * Викликається поза транзакцією БД: мережевий запит не тримає транзакцію відкритою.
   */
  async initiate(payment: Payment, params: InitiateParams): Promise<PaymentInstruction> {
    const provider = this.registry.get(payment.provider);
    try {
      const result = await provider.createPayment({
        orderReference: params.orderNumber,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        description: params.description,
        returnUrl: params.returnUrl,
        customerEmail: params.customerEmail,
      });
      if (result.externalId) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { externalId: result.externalId },
        });
      }
      return result.instruction;
    } catch (e) {
      this.logger.error(`Не вдалося ініціювати оплату ${payment.provider}: ${(e as Error).message}`);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new BadGatewayException('Платіжний сервіс тимчасово недоступний, спробуйте пізніше');
    }
  }

  /**
   * Обробка вебхука: перевірка підпису, ідемпотентність за eventId, звірка суми,
   * оновлення платежу та статусу замовлення — усе в одній транзакції, тож при збої
   * повторна доставка провайдером обробиться заново.
   */
  async handleWebhook(
    kind: PaymentProviderKind,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WebhookOutcome> {
    const provider = this.registry.get(kind);
    const v = await provider.verifyWebhook(headers, rawBody);
    if (!v.valid) throw new BadRequestException('Невалідний підпис вебхука');

    const ack = provider.webhookAck?.(v);
    if (!v.eventId || !v.orderReference) return { received: true, ignored: true, ack };

    try {
      const { mismatch, changedTo } = await this.prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({ data: { provider: kind, eventId: v.eventId! } });
        return this.apply(tx, kind, v, rawBody);
      });
      // Лист — лише після коміту: інакше покупець міг би отримати «оплачено» для відкоченої транзакції.
      if (changedTo) void this.notifications.orderStatusChanged(v.orderReference, changedTo);
      return { received: true, ack, ...(mismatch ? { mismatch: true } : {}) };
    } catch (e) {
      if (isUniqueViolation(e)) return { received: true, duplicate: true, ack };
      throw e;
    }
  }

  /** Ручна звірка оплати за рахунком (менеджер/адмін). */
  async markInvoicePaid(orderNumber: string, actorId: string): Promise<{ orderNumber: string; status: string }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: orderNumber },
        include: { payments: { where: { provider: 'BANK_INVOICE' } } },
      });
      if (!order) throw new NotFoundException(`Замовлення ${orderNumber} не знайдено`);
      const payment = order.payments[0];
      if (!payment) throw new BadRequestException('Замовлення не оплачується за рахунком');
      if (payment.status === 'SUCCEEDED') throw new ConflictException('Рахунок уже позначено оплаченим');

      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
      const status = nextOrderStatus(order.status, 'SUCCEEDED');
      if (status !== order.status) {
        await tx.order.update({ where: { id: order.id }, data: { status } });
        await logStatusChange(tx, {
          orderId: order.id,
          from: order.status,
          to: status,
          actor: actorId,
          note: 'Оплату за рахунком звірено вручну',
        });
      }
      return { orderNumber, status, changed: status !== order.status };
    });
    if (result.changed) void this.notifications.orderStatusChanged(orderNumber, result.status);
    return { orderNumber: result.orderNumber, status: result.status };
  }

  /** Застосовує подію; повертає, чи не збіглася сума, і новий статус замовлення (якщо змінився). */
  private async apply(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    kind: PaymentProviderKind,
    v: WebhookVerification,
    rawBody: string,
  ): Promise<{ mismatch: boolean; changedTo?: OrderStatus }> {
    const order = await tx.order.findUnique({
      where: { number: v.orderReference! },
      include: { payments: { where: { provider: kind }, orderBy: { createdAt: 'desc' } } },
    });
    const payment = order?.payments[0];
    if (!order || !payment) throw new NotFoundException(`Платіж для замовлення ${v.orderReference} не знайдено`);

    const rawPayload = { body: rawBody.slice(0, 10_000) };
    const amountMatches =
      (v.amountMinor == null || v.amountMinor === payment.amountMinor) &&
      (v.currency == null || v.currency === payment.currency);

    let status: PaymentStatusValue = v.status;
    if (status === 'SUCCEEDED' && !amountMatches) {
      this.logger.warn(`Сума вебхука ${kind} не збігається із замовленням ${order.number}`);
      status = 'FAILED';
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status, externalId: v.externalId ?? payment.externalId, rawPayload },
    });
    const next = nextOrderStatus(order.status, status);
    if (next === order.status) return { mismatch: !amountMatches };
    await tx.order.update({ where: { id: order.id }, data: { status: next } });
    await logStatusChange(tx, { orderId: order.id, from: order.status, to: next, actor: `webhook:${kind}` });
    return { mismatch: !amountMatches, changedTo: next };
  }
}

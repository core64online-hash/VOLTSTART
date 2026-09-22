import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Payment } from '@prisma/client';
import type { PaymentInstruction, PaymentProviderKind } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
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
      const mismatch = await this.prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({ data: { provider: kind, eventId: v.eventId! } });
        return this.apply(tx, kind, v, rawBody);
      });
      return { received: true, ack, ...(mismatch ? { mismatch: true } : {}) };
    } catch (e) {
      if (isUniqueViolation(e)) return { received: true, duplicate: true, ack };
      throw e;
    }
  }

  /** Ручна звірка оплати за рахунком (менеджер/адмін). */
  async markInvoicePaid(orderNumber: string): Promise<{ orderNumber: string; status: string }> {
    return this.prisma.$transaction(async (tx) => {
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
      await tx.order.update({ where: { id: order.id }, data: { status } });
      return { orderNumber, status };
    });
  }

  /** Повертає true, якщо сума/валюта не збіглися. */
  private async apply(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    kind: PaymentProviderKind,
    v: WebhookVerification,
    rawBody: string,
  ): Promise<boolean> {
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
    if (next !== order.status) await tx.order.update({ where: { id: order.id }, data: { status: next } });
    return !amountMatches;
  }
}

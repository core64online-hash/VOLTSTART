import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderStatus } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { CUSTOMER_NOTIFIED_STATUSES } from '../orders/order-state';
import { MAILER, type Mailer, type MailMessage } from './mailer';
import { TELEGRAM, TelegramNotifier } from './telegram';
import {
  managerOrderMessage,
  orderPlacedEmail,
  orderStatusEmail,
  passwordResetEmail,
  type OrderMailData,
} from './templates';

/**
 * Транзакційні сповіщення. Методи не кидають помилок назовні: збій пошти чи Telegram
 * не повинен ламати оформлення або вебхук — лише логуємо (черга BullMQ — наступний крок).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webUrl: string;
  private readonly managerEmail?: string;
  private readonly invoice: { recipient: string; recipientEdrpou: string; iban: string };

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Optional() @Inject(TELEGRAM) private readonly telegram: TelegramNotifier | null,
    config: ConfigService,
  ) {
    this.webUrl = (config.get<string>('WEB_PUBLIC_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    this.managerEmail = config.get<string>('MANAGER_EMAIL') || undefined;
    this.invoice = {
      recipient: config.get<string>('INVOICE_RECIPIENT') || 'ТОВ «ВОЛЬТСТАР»',
      recipientEdrpou: config.get<string>('INVOICE_RECIPIENT_EDRPOU') ?? '',
      iban: config.get<string>('INVOICE_IBAN') ?? '',
    };
  }

  /** Після оформлення: лист покупцю (для рахунку — з PDF) і повідомлення менеджерам. */
  async orderPlaced(orderNumber: string): Promise<void> {
    await this.safely(`orderPlaced ${orderNumber}`, async () => {
      const data = await this.loadOrder(orderNumber);
      if (!data) return;
      const { mail, email } = data;
      const tasks: Promise<void>[] = [this.notifyManagers(managerOrderMessage(mail, 'placed'), `Нове замовлення ${mail.number}`)];
      if (email) {
        const message: MailMessage = { to: email, ...orderPlacedEmail(mail) };
        if (mail.invoice) {
          const pdf = await this.documents.render(orderNumber, 'invoice');
          message.attachments = [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }];
        }
        tasks.push(this.mailer.send(message));
      }
      await Promise.all(tasks);
    });
  }

  /** Після зміни статусу: лист покупцю (для значущих статусів), для PAID — ще й менеджерам. */
  async orderStatusChanged(orderNumber: string, status: OrderStatus): Promise<void> {
    await this.safely(`orderStatusChanged ${orderNumber} → ${status}`, async () => {
      if (!CUSTOMER_NOTIFIED_STATUSES.includes(status)) return;
      const data = await this.loadOrder(orderNumber);
      if (!data) return;
      const tasks: Promise<void>[] = [];
      if (data.email) tasks.push(this.mailer.send({ to: data.email, ...orderStatusEmail(data.mail) }));
      if (status === 'PAID') tasks.push(this.notifyManagers(managerOrderMessage(data.mail, 'paid'), `Оплачено ${orderNumber}`));
      await Promise.all(tasks);
    });
  }

  async passwordReset(email: string, link: string, ttlMinutes: number): Promise<void> {
    await this.safely(`passwordReset ${email}`, () => this.mailer.send({ to: email, ...passwordResetEmail(link, ttlMinutes) }));
  }

  private async notifyManagers(text: string, subject: string): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (this.telegram) jobs.push(this.telegram.send(text));
    if (this.managerEmail) jobs.push(this.mailer.send({ to: this.managerEmail, subject, text, html: `<pre>${text}</pre>` }));
    await Promise.all(jobs);
  }

  private async loadOrder(orderNumber: string): Promise<{ mail: OrderMailData; email: string | null } | null> {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      include: { items: { include: { product: true } }, payments: true },
    });
    if (!order) return null;
    const byInvoice = order.payments.some((p) => p.provider === 'BANK_INVOICE');
    const email = order.contactEmail;
    const params = new URLSearchParams({ number: order.number, ...(email ? { email } : {}) });
    return {
      email,
      mail: {
        number: order.number,
        status: order.status,
        segment: order.segment,
        currency: order.currency,
        totalMinor: order.totalMinor,
        contactName: order.contactName,
        items: order.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          totalMinor: i.unitPriceMinor * i.quantity,
        })),
        orderUrl: `${this.webUrl}/uk/orders/track?${params.toString()}`,
        invoice: byInvoice ? this.invoice : null,
      },
    };
  }

  private async safely(what: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.logger.error(`Сповіщення не надіслано (${what}): ${(e as Error).message}`);
    }
  }
}

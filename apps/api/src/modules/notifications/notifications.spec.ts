import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { createMailer, type MailMessage } from './mailer';
import { NotificationsService } from './notifications.service';
import { TelegramNotifier } from './telegram';
import {
  managerOrderMessage,
  orderPlacedEmail,
  orderStatusEmail,
  passwordResetEmail,
  type OrderMailData,
} from './templates';

const mail: OrderMailData = {
  number: 'VS-1',
  status: 'INVOICED',
  segment: 'B2B',
  currency: 'UAH',
  totalMinor: 3_535_050,
  contactName: 'Петро <script>',
  items: [{ name: 'Generac GP3300', quantity: 2, totalMinor: 3_400_000 }],
  orderUrl: 'http://localhost:3000/uk/orders/track?number=VS-1',
  invoice: { recipient: 'ТОВ «ВОЛЬТСТАР»', recipientEdrpou: '14360570', iban: 'UA21322313' },
};

describe('templates', () => {
  it('лист про оформлення з рахунком містить реквізити, суму й посилання', () => {
    const m = orderPlacedEmail(mail);
    expect(m.subject).toBe('Замовлення VS-1 прийнято — VOLTSTAR');
    expect(m.text).toContain('IBAN: UA21322313');
    expect(m.text).toMatch(/35\s?350,50/);
    expect(m.html).toContain('<a href="http://localhost:3000/uk/orders/track?number=VS-1">');
  });

  it('HTML екранує дані покупця', () => {
    const m = orderPlacedEmail(mail);
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });

  it('картковий платіж без реквізитів — нагадування про автоматичне оновлення', () => {
    const m = orderPlacedEmail({ ...mail, status: 'PENDING_PAYMENT', invoice: null });
    expect(m.text).not.toContain('IBAN');
    expect(m.text).toContain('оновиться автоматично');
  });

  it('лист про статус і скидання паролю', () => {
    expect(orderStatusEmail({ ...mail, status: 'SHIPPED' }).subject).toBe('Замовлення VS-1: замовлення відправлено — VOLTSTAR');
    const reset = passwordResetEmail('http://x/reset?token=abc', 60);
    expect(reset.text).toContain('http://x/reset?token=abc');
    expect(reset.text).toContain('60 хв');
  });

  it('повідомлення менеджеру', () => {
    expect(managerOrderMessage(mail, 'placed')).toMatch(/^🆕 Нове замовлення VS-1\nB2B · рахунок/);
    expect(managerOrderMessage({ ...mail, invoice: null }, 'paid')).toMatch(/^💰 Оплачено VS-1\nB2B · картка/);
  });
});

describe('createMailer', () => {
  it('без SMTP_HOST — лише лог, без мережі', async () => {
    const log = vi.fn();
    const mailer = createMailer(() => undefined, { log });
    await mailer.send({ to: 'a@b.ua', subject: 'Тест', text: 'x' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('to=a@b.ua subject="Тест"'));
  });
});

describe('TelegramNotifier', () => {
  it('надсилає sendMessage у заданий чат; помилка API — виняток', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await new TelegramNotifier('TOKEN', '-100', fetchFn).send('привіт');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '-100', text: 'привіт' });

    const failing = new TelegramNotifier('T', 'C', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(failing.send('x')).rejects.toThrow(/403/);
  });
});

describe('NotificationsService', () => {
  const config = {
    get: (k: string) =>
      ({ WEB_PUBLIC_URL: 'https://voltstar.ua/', MANAGER_EMAIL: 'sales@voltstar.ua', INVOICE_IBAN: 'UA21' })[k],
  } as unknown as ConfigService;

  function setup(payments = [{ provider: 'BANK_INVOICE' }], status = 'INVOICED') {
    const sent: MailMessage[] = [];
    const mailer = { send: vi.fn(async (m: MailMessage) => void sent.push(m)) };
    const telegram = { send: vi.fn(async () => undefined) };
    const documents = { render: vi.fn(async () => ({ filename: 'rakhunok-VS-1.pdf', content: Buffer.from('%PDF') })) };
    const prisma = {
      order: {
        findUnique: vi.fn(async () => ({
          number: 'VS-1',
          status,
          segment: 'B2B',
          currency: 'UAH',
          totalMinor: 100,
          contactName: 'Петро',
          contactEmail: 'buyer@firm.ua',
          items: [{ quantity: 1, unitPriceMinor: 100, product: { name: 'Генератор' } }],
          payments,
        })),
      },
    };
    const service = new NotificationsService(prisma as never, documents as never, mailer, telegram as never, config);
    return { service, sent, telegram, documents };
  }

  it('оформлення за рахунком: лист покупцю з PDF, менеджерам — Telegram і email', async () => {
    const { service, sent, telegram } = setup();
    await service.orderPlaced('VS-1');
    const buyer = sent.find((m) => m.to === 'buyer@firm.ua')!;
    expect(buyer.attachments?.[0]).toMatchObject({ filename: 'rakhunok-VS-1.pdf', contentType: 'application/pdf' });
    expect(buyer.text).toContain('https://voltstar.ua/uk/orders/track?number=VS-1&email=buyer%40firm.ua');
    expect(sent.some((m) => m.to === 'sales@voltstar.ua')).toBe(true);
    expect(telegram.send).toHaveBeenCalledWith(expect.stringContaining('Нове замовлення VS-1'));
  });

  it('карткова оплата — без вкладення', async () => {
    const { service, sent, documents } = setup([{ provider: 'WAYFORPAY' }], 'PENDING_PAYMENT');
    await service.orderPlaced('VS-1');
    expect(documents.render).not.toHaveBeenCalled();
    expect(sent.find((m) => m.to === 'buyer@firm.ua')?.attachments).toBeUndefined();
  });

  it('статус PROCESSING покупцю не надсилається; PAID — покупцю і менеджерам', async () => {
    const quiet = setup();
    await quiet.service.orderStatusChanged('VS-1', 'PROCESSING');
    expect(quiet.sent).toHaveLength(0);

    const paid = setup();
    await paid.service.orderStatusChanged('VS-1', 'PAID');
    expect(paid.sent.map((m) => m.to).sort()).toEqual(['buyer@firm.ua', 'sales@voltstar.ua']);
    expect(paid.telegram.send).toHaveBeenCalledWith(expect.stringContaining('Оплачено VS-1'));
  });

  it('збій пошти не прокидається назовні (не ламає checkout/вебхук)', async () => {
    const { service } = setup();
    (service as unknown as { mailer: { send: () => Promise<void> } }).mailer.send = async () => {
      throw new Error('SMTP down');
    };
    await expect(service.orderPlaced('VS-1')).resolves.toBeUndefined();
  });
});

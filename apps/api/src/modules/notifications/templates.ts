import type { Currency, OrderStatus, Segment } from '@voltstar/types';

export interface OrderMailData {
  number: string;
  status: OrderStatus;
  segment: Segment;
  currency: Currency;
  totalMinor: number;
  contactName: string | null;
  items: Array<{ name: string; quantity: number; totalMinor: number }>;
  /** Посилання на сторінку відстеження замовлення. */
  orderUrl: string;
  /** Реквізити для оплати за рахунком (гілка INVOICE). */
  invoice?: { recipient: string; recipientEdrpou: string; iban: string } | null;
}

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

export const STATUS_LABEL_UK: Record<OrderStatus, string> = {
  DRAFT: 'чернетка',
  PENDING_PAYMENT: 'очікує оплати',
  PAID: 'оплачено',
  INVOICED: 'виставлено рахунок',
  PROCESSING: 'комплектується',
  SHIPPED: 'відправлено',
  DELIVERED: 'доставлено',
  CANCELLED: 'скасовано',
  REFUNDED: 'кошти повернено',
};

const STATUS_SUBJECT: Partial<Record<OrderStatus, string>> = {
  PAID: 'оплату отримано',
  SHIPPED: 'замовлення відправлено',
  DELIVERED: 'замовлення доставлено',
  CANCELLED: 'замовлення скасовано',
  REFUNDED: 'кошти повернено',
};

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(minor / 100);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Текст → простий HTML (порожній рядок = новий абзац, посилання клікабельні). */
function toHtml(text: string): string {
  const paragraphs = text.split('\n\n').map((p) =>
    escapeHtml(p)
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
      .replace(/\n/g, '<br>'),
  );
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>`;
}

function build(subject: string, text: string): MailContent {
  return { subject, text, html: toHtml(text) };
}

const greeting = (name: string | null) => (name ? `Вітаємо, ${name}!` : 'Вітаємо!');

function itemsBlock(o: OrderMailData): string {
  return o.items.map((i) => `• ${i.name} × ${i.quantity} — ${formatMoney(i.totalMinor, o.currency)}`).join('\n');
}

/** Лист покупцю після оформлення. */
export function orderPlacedEmail(o: OrderMailData): MailContent {
  const lines = [
    greeting(o.contactName),
    `Дякуємо за замовлення ${o.number} у VOLTSTAR.`,
    `${itemsBlock(o)}\nРазом: ${formatMoney(o.totalMinor, o.currency)}`,
  ];
  if (o.invoice) {
    lines.push(
      `Рахунок-фактуру додано до листа. Реквізити для оплати:\nОтримувач: ${o.invoice.recipient}\nЄДРПОУ: ${o.invoice.recipientEdrpou}\nIBAN: ${o.invoice.iban}\nПризначення: Оплата за рахунком № ${o.number}, у т.ч. ПДВ`,
      'Після надходження коштів менеджер підтвердить замовлення.',
    );
  } else if (o.status === 'PENDING_PAYMENT') {
    lines.push('Статус оплати оновиться автоматично, щойно платіжна система її підтвердить.');
  }
  lines.push(`Стежити за замовленням: ${o.orderUrl}`);
  return build(`Замовлення ${o.number} прийнято — VOLTSTAR`, lines.join('\n\n'));
}

/** Лист покупцю про зміну статусу. */
export function orderStatusEmail(o: OrderMailData): MailContent {
  const what = STATUS_SUBJECT[o.status] ?? `статус: ${STATUS_LABEL_UK[o.status]}`;
  const text = [
    greeting(o.contactName),
    `Замовлення ${o.number}: ${STATUS_LABEL_UK[o.status]}.`,
    `Сума замовлення: ${formatMoney(o.totalMinor, o.currency)}`,
    `Деталі: ${o.orderUrl}`,
  ].join('\n\n');
  return build(`Замовлення ${o.number}: ${what} — VOLTSTAR`, text);
}

/** Лист зі скиданням паролю. */
export function passwordResetEmail(link: string, ttlMinutes: number): MailContent {
  const text = [
    'Вітаємо!',
    'Ми отримали запит на скидання паролю до вашого акаунта VOLTSTAR.',
    `Щоб встановити новий пароль, перейдіть за посиланням (діє ${ttlMinutes} хв):\n${link}`,
    'Якщо ви не робили цього запиту — просто проігноруйте лист, пароль не зміниться.',
  ].join('\n\n');
  return build('Скидання паролю — VOLTSTAR', text);
}

/** Коротке повідомлення менеджерам (Telegram / email). */
export function managerOrderMessage(o: OrderMailData, event: 'placed' | 'paid'): string {
  const head = event === 'placed' ? '🆕 Нове замовлення' : '💰 Оплачено';
  const payment = o.invoice ? 'рахунок' : 'картка';
  return `${head} ${o.number}\n${o.segment} · ${payment} · ${formatMoney(o.totalMinor, o.currency)}\n${o.contactName ?? '—'}\n${o.orderUrl}`;
}

import { describe, expect, it, vi } from 'vitest';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { CrmService } from './crm.service';

/** Перший аргумент виклику фейкового методу (`{ data }` / `{ where }`). */
type CallArg = { data: Record<string, unknown>; where: { OR?: unknown; createdAt: { gte: Date } } };
const arg = (fn: { mock: { calls: unknown[][] } }, i = 0) => fn.mock.calls[i]![0] as CallArg;

/** Мінімальний фейк Prisma: лише методи, які зачіпають перевірені сценарії. */
function setup(state: {
  duplicate?: { id: string } | null;
  managers?: { id: string }[];
  load?: { ownerId: string; _count: { _all: number } }[];
  order?: Record<string, unknown> | null;
  deal?: { id: string; stage: string } | null;
  /** Статус замовлення на момент створення угоди (перечитується в транзакції). */
  orderStatusNow?: string;
} = {}) {
  const db = {
    lead: {
      findFirst: vi.fn(async () => state.duplicate ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'lead-new',
        ...data,
        owner: data.ownerId ? { id: data.ownerId, email: `${data.ownerId}@voltstar.ua` } : null,
      })),
      groupBy: vi.fn(async () => state.load ?? []),
    },
    user: { findMany: vi.fn(async () => state.managers ?? []) },
    activity: { create: vi.fn(async () => ({ id: 'act' })) },
    order: {
      findUnique: vi.fn(async ({ select }: { select?: unknown }) =>
        select ? { status: state.orderStatusNow ?? 'INVOICED' } : state.order ?? null,
      ),
    },
    deal: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => ('order' in where ? state.deal ?? null : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'deal-new', ...data })),
      update: vi.fn(async () => ({})),
    },
    company: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'company-new' })),
    },
    contact: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'contact-new' })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  const notifications = { leadCreated: vi.fn(async () => undefined) };
  const crm = new CrmService(db as unknown as PrismaService, notifications as unknown as NotificationsService);
  return { crm, db, notifications };
}

const lead = { source: 'b2b-request' as const, name: 'Петро', phone: '+38 050 123 45 67', companyName: 'ТОВ «Альфа»' };

describe('CrmService.createLead', () => {
  it('новий лід: нормалізований телефон, сегмент за джерелом, найменш завантажений менеджер, сповіщення', async () => {
    const { crm, db, notifications } = setup({
      managers: [{ id: 'm1' }, { id: 'm2' }],
      load: [{ ownerId: 'm1', _count: { _all: 4 } }],
    });
    const res = await crm.createLead(lead);
    expect(res).toEqual({ leadId: 'lead-new', duplicate: false });
    expect(arg(db.lead.create).data).toMatchObject({ phone: '380501234567', segment: 'B2B', ownerId: 'm2' });
    expect(notifications.leadCreated).toHaveBeenCalledWith(
      expect.objectContaining({ ownerEmail: 'm2@voltstar.ua', source: 'запит B2B', companyName: 'ТОВ «Альфа»' }),
    );
  });

  it('без менеджерів лід створюється непризначеним', async () => {
    const { crm, db } = setup();
    await crm.createLead(lead);
    expect(arg(db.lead.create).data.ownerId).toBeNull();
  });

  it('повторна заявка протягом доби → запис в історії відкритого ліда, без дубля', async () => {
    const { crm, db, notifications } = setup({ duplicate: { id: 'lead-old' } });
    const res = await crm.createLead({ ...lead, message: 'Ще й ATS' });
    expect(res).toEqual({ leadId: 'lead-old', duplicate: true });
    expect(db.lead.create).not.toHaveBeenCalled();
    expect(notifications.leadCreated).not.toHaveBeenCalled();
    expect(arg(db.activity.create).data).toMatchObject({ leadId: 'lead-old', type: 'system' });
    expect(arg(db.activity.create).data.content).toContain('Ще й ATS');
    // Шукаємо дубль за телефоном у відкритих лідах за останні 24 год.
    const where = arg(db.lead.findFirst).where;
    expect(where.OR).toEqual([{ phone: '380501234567' }]);
    expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThanOrEqual(24 * 3600e3 + 1000);
  });
});

const b2bOrder = {
  id: 'o1',
  number: 'VS-1',
  segment: 'B2B',
  totalMinor: 1_700_000,
  currency: 'UAH',
  contactName: 'Андрій',
  contactEmail: 'A@Firm.ua',
  contactPhone: '+380671234567',
  userId: 'u1',
  organization: { id: 'org1', name: 'ТОВ «Будмонтаж»', edrpou: '14360570', segment: 'B2B' },
  deal: null,
};

describe('CrmService — звʼязок із замовленнями', () => {
  it('B2B-замовлення → угода «Пропозиція» на суму замовлення з компанією й контактом', async () => {
    const { crm, db } = setup({ order: b2bOrder, managers: [{ id: 'm1' }] });
    await crm.onOrderPlaced('VS-1');
    expect(arg(db.company.create).data).toMatchObject({ edrpou: '14360570', orgId: 'org1' });
    expect(arg(db.contact.create).data).toMatchObject({ email: 'a@firm.ua', phone: '380671234567', userId: 'u1' });
    expect(arg(db.deal.create).data).toMatchObject({
      stage: 'PROPOSAL',
      amountMinor: 1_700_000,
      orderId: 'o1',
      companyId: 'company-new',
      contactId: 'contact-new',
      ownerId: 'm1',
    });
  });

  it('рахунок звірили раніше, ніж створилась угода → угода одразу «Виграна»', async () => {
    const { crm, db } = setup({ order: b2bOrder, orderStatusNow: 'PAID' });
    await crm.onOrderPlaced('VS-1');
    expect(arg(db.deal.create).data).toMatchObject({ stage: 'WON', lostReason: null });
    expect(arg(db.deal.create).data.closedAt).toBeInstanceOf(Date);
    expect(arg(db.activity.create).data.content).toContain('уже оплачено');
  });

  it('B2C-замовлення і повторна обробка угоду не створюють', async () => {
    for (const order of [{ ...b2bOrder, segment: 'B2C' }, { ...b2bOrder, deal: { id: 'd0' } }]) {
      const { crm, db } = setup({ order });
      await crm.onOrderPlaced('VS-1');
      expect(db.deal.create).not.toHaveBeenCalled();
    }
  });

  it('збій CRM не ламає оформлення (помилка лише логується)', async () => {
    const { crm, db } = setup({ order: b2bOrder });
    db.$transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(crm.onOrderPlaced('VS-1')).resolves.toBeUndefined();
  });

  it('оплата → «Виграна», скасування → «Програна» з причиною; закриту угоду не чіпаємо', async () => {
    let s = setup({ deal: { id: 'd1', stage: 'PROPOSAL' } });
    await s.crm.onOrderStatus('VS-1', 'PAID');
    expect(arg(s.db.deal.update).data).toMatchObject({ stage: 'WON', lostReason: null });
    expect(arg(s.db.activity.create).data.content).toBe('Стадія: Пропозиція → Виграна (за замовленням VS-1)');

    s = setup({ deal: { id: 'd1', stage: 'NEGOTIATION' } });
    await s.crm.onOrderStatus('VS-1', 'CANCELLED');
    expect(arg(s.db.deal.update).data).toMatchObject({ stage: 'LOST', lostReason: 'Замовлення скасовано' });

    s = setup({ deal: { id: 'd1', stage: 'WON' } });
    await s.crm.onOrderStatus('VS-1', 'REFUNDED');
    expect(s.db.deal.update).not.toHaveBeenCalled();

    s = setup({ deal: { id: 'd1', stage: 'PROPOSAL' } });
    await s.crm.onOrderStatus('VS-1', 'SHIPPED');
    expect(s.db.deal.findFirst).not.toHaveBeenCalled();
  });
});

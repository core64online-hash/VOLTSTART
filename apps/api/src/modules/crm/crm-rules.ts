import { BadRequestException } from '@nestjs/common';
import type { DealStage, LeadSource, LeadStatus, OrderStatus, Segment } from '@voltstar/types';

/** Ліди, з якими ще працюють (для призначення менеджера й пошуку дублікатів). */
export const OPEN_LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

/** Вікно, у якому повторна заявка з тим самим телефоном/email вважається дублікатом. */
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Телефон у вигляді 380XXXXXXXXX для українських номерів (0XX…, XX…, +380…),
 * інакше — лише цифри. Менше 7 цифр — null (не номер).
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10 && digits.startsWith('0')) return `38${digits}`;
  if (digits.length === 9) return `380${digits}`;
  return digits;
}

export function segmentForSource(source: LeadSource): Segment {
  if (source === 'b2b-request') return 'B2B';
  if (source === 'b2g-request') return 'B2G';
  return 'B2C';
}

/** Ручні переходи ліда. CONVERTED ставиться лише конвертацією в угоду. */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'DISQUALIFIED'],
  CONTACTED: ['QUALIFIED', 'DISQUALIFIED'],
  QUALIFIED: ['CONTACTED', 'DISQUALIFIED'],
  CONVERTED: [],
  DISQUALIFIED: ['NEW'],
};

export function assertLeadTransition(from: LeadStatus, to: LeadStatus): void {
  if (to === 'CONVERTED') throw new BadRequestException('Щоб конвертувати лід, створіть із нього угоду');
  if (!LEAD_TRANSITIONS[from].includes(to)) throw new BadRequestException(`Перехід ліда ${from} → ${to} недоступний`);
}

/** Стадії воронки в порядку канбану. */
export const DEAL_STAGES: DealStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

/** Назви стадій для системних записів в історії угоди. */
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  NEW: 'Нова',
  QUALIFIED: 'Кваліфікована',
  PROPOSAL: 'Пропозиція',
  NEGOTIATION: 'Переговори',
  WON: 'Виграна',
  LOST: 'Програна',
};
export const CLOSED_STAGES: DealStage[] = ['WON', 'LOST'];

/**
 * Відкриту угоду можна пересувати будь-куди (і назад); закриту — ні.
 * Програш без причини не приймаємо — інакше воронку неможливо аналізувати.
 */
export function assertDealTransition(from: DealStage, to: DealStage, lostReason?: string): void {
  if (CLOSED_STAGES.includes(from)) throw new BadRequestException('Угоду вже закрито');
  if (from === to) throw new BadRequestException('Угода вже на цій стадії');
  if (to === 'LOST' && !lostReason?.trim()) throw new BadRequestException('Вкажіть причину програшу');
}

/** Найменш завантажений менеджер (за кількістю відкритих лідів); при рівності — стабільно за id. */
export function pickAssignee(candidates: Array<{ id: string; openLeads: number }>): string | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => a.openLeads - b.openLeads || a.id.localeCompare(b.id))[0].id;
}

/** Стадія угоди, до якої веде зміна статусу повʼязаного замовлення (або null — без змін). */
export function dealStageForOrder(status: OrderStatus): DealStage | null {
  if (status === 'PAID') return 'WON';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'LOST';
  return null;
}

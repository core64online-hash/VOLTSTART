export const ANALYTICS_TZ = 'Europe/Kyiv';
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_PERIOD_DAYS = 366;

/** Календарна дата (РРРР-ММ-ДД) моменту `d` у часовому поясі звітів. */
export function localDate(d: Date, tz = ANALYTICS_TZ): string {
  // en-CA дає саме формат РРРР-ММ-ДД.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Зсув часового поясу (мс) відносно UTC у момент `d`. */
function offsetMs(d: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** UTC-момент місцевої півночі дати `date` (перехід на літній час у Києві — о 3:00/4:00, тож північ однозначна). */
export function localMidnightUtc(date: string, tz = ANALYTICS_TZ): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - offsetMs(new Date(guess), tz));
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface Period {
  from: string;
  to: string;
  /** Початок першого дня (включно), UTC. */
  start: Date;
  /** Початок дня після останнього (не включно), UTC. */
  end: Date;
  days: string[];
}

/** Період звіту: за замовчуванням останні 30 днів до сьогодні включно; не довше за рік. */
export function resolvePeriod(q: { from?: string; to?: string }, now: Date = new Date()): Period {
  const to = q.to ?? localDate(now);
  const from = q.from ?? addDays(to, -29);
  const days: string[] = [];
  for (let d = from; d <= to && days.length <= MAX_PERIOD_DAYS; d = addDays(d, 1)) days.push(d);
  if (days.length > MAX_PERIOD_DAYS) throw new RangeError(`Період не може бути довшим за ${MAX_PERIOD_DAYS} днів`);
  return { from, to, start: localMidnightUtc(from), end: localMidnightUtc(addDays(to, 1)), days };
}

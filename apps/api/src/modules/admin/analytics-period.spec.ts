import { describe, expect, it } from 'vitest';
import { addDays, localDate, localMidnightUtc, resolvePeriod } from './analytics-period';

describe('analytics-period (Europe/Kyiv)', () => {
  it('календарна дата — за Києвом, а не за UTC', () => {
    // 22:30 UTC 23 вересня — у Києві вже 24-те (UTC+3 влітку).
    expect(localDate(new Date('2026-09-23T22:30:00Z'))).toBe('2026-09-24');
    // Узимку UTC+2: 21:59 UTC — ще той самий день.
    expect(localDate(new Date('2026-01-10T21:59:00Z'))).toBe('2026-01-10');
  });

  it('місцева північ у UTC з урахуванням літнього/зимового часу', () => {
    expect(localMidnightUtc('2026-07-01').toISOString()).toBe('2026-06-30T21:00:00.000Z');
    expect(localMidnightUtc('2026-01-15').toISOString()).toBe('2026-01-14T22:00:00.000Z');
    // День переходу на літній час (29 березня 2026) — північ ще за зимовим часом.
    expect(localMidnightUtc('2026-03-29').toISOString()).toBe('2026-03-28T22:00:00.000Z');
    expect(localMidnightUtc('2026-03-30').toISOString()).toBe('2026-03-29T21:00:00.000Z');
  });

  it('період за замовчуванням — 30 днів до сьогодні включно, межі — півночі', () => {
    const p = resolvePeriod({}, new Date('2026-09-23T10:00:00Z'));
    expect(p.from).toBe('2026-08-25');
    expect(p.to).toBe('2026-09-23');
    expect(p.days).toHaveLength(30);
    expect(p.start.toISOString()).toBe('2026-08-24T21:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-09-23T21:00:00.000Z');
  });

  it('довгі періоди відхиляються; addDays переходить через місяць', () => {
    expect(() => resolvePeriod({ from: '2025-01-01', to: '2026-06-01' })).toThrow(RangeError);
    expect(resolvePeriod({ from: '2025-01-01', to: '2025-12-31' }).days).toHaveLength(365);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

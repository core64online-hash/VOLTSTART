import { timingSafeEqual } from 'node:crypto';

/** Порівняння підписів за постійний час (захист від timing-атак). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Розбирає тіло як JSON; повертає null, якщо це не JSON-обʼєкт. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const str = (v: unknown): string => (v == null ? '' : String(v));

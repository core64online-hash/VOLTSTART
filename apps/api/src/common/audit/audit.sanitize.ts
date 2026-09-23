/** Ключі, значення яких ніколи не пишемо в журнал. */
const SECRET_KEY = /pass(word)?|token|secret|authorization|signature|card|cvv/i;
const MAX_STRING = 500;
const MAX_DEPTH = 5;
const MAX_KEYS = 50;

/**
 * Готує дані запиту до запису в аудит: прибирає секрети, обрізає довгі рядки
 * та глибокі/великі структури, щоб журнал лишався компактним і безпечним.
 */
export function sanitizeAuditData(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_KEYS).map((v) => sanitizeAuditData(v, depth + 1));
    return value.length > MAX_KEYS ? [...items, `… ще ${value.length - MAX_KEYS}`] : items;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[k] = SECRET_KEY.test(k) ? '[приховано]' : sanitizeAuditData(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

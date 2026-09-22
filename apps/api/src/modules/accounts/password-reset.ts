import { createHash, randomBytes } from 'node:crypto';

export const RESET_TOKEN_TTL_MINUTES = 60;

/** sha256 токена — у БД зберігаємо лише хеш, щоб витік бази не давав робочих посилань. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Новий одноразовий токен (256 біт) із хешем і терміном дії. */
export function newResetToken(now: Date = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000),
  };
}

/** Токен придатний, якщо ще не використаний і не прострочений. */
export function isResetTokenUsable(record: { usedAt: Date | null; expiresAt: Date }, now: Date = new Date()): boolean {
  return record.usedAt == null && record.expiresAt.getTime() > now.getTime();
}

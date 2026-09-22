import { describe, expect, it } from 'vitest';
import { hashResetToken, isResetTokenUsable, newResetToken, RESET_TOKEN_TTL_MINUTES } from './password-reset';

describe('password reset tokens', () => {
  const now = new Date('2026-09-22T10:00:00Z');

  it('токен довгий і випадковий, у БД — лише хеш', () => {
    const a = newResetToken(now);
    const b = newResetToken(now);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43); // 256 біт у base64url
    expect(a.tokenHash).toBe(hashResetToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
    expect(a.expiresAt.getTime() - now.getTime()).toBe(RESET_TOKEN_TTL_MINUTES * 60_000);
  });

  it('придатний лише невикористаний і не прострочений токен', () => {
    const expiresAt = new Date(now.getTime() + 60_000);
    expect(isResetTokenUsable({ usedAt: null, expiresAt }, now)).toBe(true);
    expect(isResetTokenUsable({ usedAt: now, expiresAt }, now)).toBe(false);
    expect(isResetTokenUsable({ usedAt: null, expiresAt }, new Date(expiresAt.getTime() + 1))).toBe(false);
  });
});

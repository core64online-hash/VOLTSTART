import { createHmac, timingSafeEqual } from 'node:crypto';

/** Помилка перевірки/розбору JWT. */
export class JwtError extends Error {}

export interface SignOptions {
  secret: string;
  /** Час життя токена, секунди. */
  expiresInSec: number;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/**
 * Підписує JWT (HS256). До payload додаються claims iat/exp.
 * Мінімальна реалізація на node:crypto — сумісна з форматом JWS Compact.
 */
export function signJwt(payload: Record<string, unknown>, opts: SignOptions): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: nowSec, exp: nowSec + opts.expiresInSec };
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = createHmac('sha256', opts.secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Перевіряє підпис і термін дії токена; повертає payload.
 * Кидає {@link JwtError} за будь-якої некоректності.
 */
export function verifyJwt(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('Некоректний формат токена');
  const [headerB64, bodyB64, sigB64] = parts;

  const data = `${headerB64}.${bodyB64}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const actual = Buffer.from(sigB64, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new JwtError('Невірний підпис токена');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
  } catch {
    throw new JwtError('Некоректний payload токена');
  }

  const exp = payload.exp;
  if (typeof exp === 'number' && exp < Math.floor(Date.now() / 1000)) {
    throw new JwtError('Термін дії токена вичерпано');
  }
  return payload;
}

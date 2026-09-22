import { describe, expect, it } from 'vitest';
import { JwtError, signJwt, verifyJwt } from './jwt.util';

const SECRET = 'test-secret';

describe('jwt util', () => {
  it('підписує й перевіряє токен (round-trip)', () => {
    const token = signJwt({ sub: 'u1', role: 'CUSTOMER' }, { secret: SECRET, expiresInSec: 60 });
    const payload = verifyJwt(token, SECRET);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('CUSTOMER');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('відхиляє токен із невірним секретом', () => {
    const token = signJwt({ sub: 'u1' }, { secret: SECRET, expiresInSec: 60 });
    expect(() => verifyJwt(token, 'other-secret')).toThrow(JwtError);
  });

  it('відхиляє підроблений токен', () => {
    const token = signJwt({ sub: 'u1' }, { secret: SECRET, expiresInSec: 60 });
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(() => verifyJwt(tampered, SECRET)).toThrow(JwtError);
  });

  it('відхиляє прострочений токен', () => {
    const token = signJwt({ sub: 'u1' }, { secret: SECRET, expiresInSec: -10 });
    expect(() => verifyJwt(token, SECRET)).toThrow(/Термін дії/);
  });

  it('відхиляє некоректний формат', () => {
    expect(() => verifyJwt('not-a-jwt', SECRET)).toThrow(JwtError);
  });
});

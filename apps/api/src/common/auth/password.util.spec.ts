import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.util';

describe('password util', () => {
  it('хеш верифікується коректним паролем', () => {
    const hash = hashPassword('S3cret!!');
    expect(hash).toContain(':');
    expect(verifyPassword('S3cret!!', hash)).toBe(true);
  });

  it('відхиляє невірний пароль', () => {
    const hash = hashPassword('S3cret!!');
    expect(verifyPassword('wrong-pass', hash)).toBe(false);
  });

  it('різні виклики дають різний salt (унікальні хеші)', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('відхиляє зіпсований формат сховища', () => {
    expect(verifyPassword('x', 'no-colon-here')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});

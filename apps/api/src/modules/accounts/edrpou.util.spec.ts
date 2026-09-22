import { describe, expect, it } from 'vitest';
import { isValidEdrpou, isValidVat } from './edrpou.util';

describe('isValidEdrpou', () => {
  it('приймає коректні коди ЄДРПОУ (реальні контрольні суми)', () => {
    expect(isValidEdrpou('14360570')).toBe(true); // ПриватБанк
    expect(isValidEdrpou('00032129')).toBe(true); // Ощадбанк
  });

  it('відхиляє код із невірною контрольною цифрою', () => {
    expect(isValidEdrpou('12345670')).toBe(false);
    expect(isValidEdrpou('14360571')).toBe(false);
  });

  it('відхиляє некоректний формат', () => {
    expect(isValidEdrpou('1234567')).toBe(false); // 7 цифр
    expect(isValidEdrpou('143605700')).toBe(false); // 9 цифр
    expect(isValidEdrpou('')).toBe(false);
    expect(isValidEdrpou('abcdefgh')).toBe(false);
    expect(isValidEdrpou('1436 570')).toBe(false);
  });
});

describe('isValidVat', () => {
  it('приймає 10- та 12-значні номери', () => {
    expect(isValidVat('1234567890')).toBe(true);
    expect(isValidVat('123456789012')).toBe(true);
  });

  it('відхиляє іншу довжину або нецифрові символи', () => {
    expect(isValidVat('12345')).toBe(false);
    expect(isValidVat('12345678901')).toBe(false); // 11 цифр
    expect(isValidVat('12345abcde')).toBe(false);
  });
});

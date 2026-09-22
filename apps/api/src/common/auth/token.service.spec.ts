import { describe, expect, it } from 'vitest';
import { parseDuration } from './token.service';

describe('parseDuration', () => {
  it('парсить одиниці s/m/h/d', () => {
    expect(parseDuration('30s', 0)).toBe(30);
    expect(parseDuration('15m', 0)).toBe(900);
    expect(parseDuration('2h', 0)).toBe(7200);
    expect(parseDuration('7d', 0)).toBe(604800);
  });

  it('парсить голе число як секунди', () => {
    expect(parseDuration('3600', 0)).toBe(3600);
  });

  it('повертає fallback за некоректного значення', () => {
    expect(parseDuration('bad', 900)).toBe(900);
    expect(parseDuration('', 900)).toBe(900);
    expect(parseDuration('-5', 900)).toBe(900);
  });
});

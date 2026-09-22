import { describe, expect, it } from 'vitest';
import { integerInWords, pluralUk, uahAmountInWords } from './amount-in-words';

describe('pluralUk', () => {
  const f: [string, string, string] = ['гривня', 'гривні', 'гривень'];
  it('1 / 2–4 / 5+ та виняток 11–14', () => {
    expect([1, 21, 101].map((n) => pluralUk(n, f))).toEqual(['гривня', 'гривня', 'гривня']);
    expect([2, 3, 4, 22, 104].map((n) => pluralUk(n, f))).toEqual(Array(5).fill('гривні'));
    expect([0, 5, 11, 12, 14, 111, 1000].map((n) => pluralUk(n, f))).toEqual(Array(7).fill('гривень'));
  });
});

describe('integerInWords', () => {
  it('рід: гривня й тисяча — жіночого, мільйон — чоловічого', () => {
    expect(integerInWords(1)).toBe('одна');
    expect(integerInWords(2)).toBe('дві');
    expect(integerInWords(1_001)).toBe('одна тисяча одна');
    expect(integerInWords(2_000)).toBe('дві тисячі');
    expect(integerInWords(1_000_000)).toBe('один мільйон');
    expect(integerInWords(2_000_000)).toBe('два мільйони');
    expect(integerInWords(1, false)).toBe('один');
  });

  it('десятки, сотні, «-надцять»', () => {
    expect(integerInWords(11)).toBe('одинадцять');
    expect(integerInWords(219)).toBe('двісті девʼятнадцять');
    expect(integerInWords(990)).toBe('девʼятсот девʼяносто');
    expect(integerInWords(12_345)).toBe('дванадцять тисяч триста сорок пʼять');
  });

  it('нуль і межі діапазону', () => {
    expect(integerInWords(0)).toBe('нуль');
    expect(() => integerInWords(-1)).toThrow(RangeError);
    expect(() => integerInWords(1.5)).toThrow(RangeError);
  });
});

describe('uahAmountInWords', () => {
  it('гривні прописом, копійки цифрами, з великої літери', () => {
    expect(uahAmountInWords(1_899_000)).toBe('Вісімнадцять тисяч девʼятсот девʼяносто гривень 00 копійок');
    expect(uahAmountInWords(3_535_050)).toBe('Тридцять пʼять тисяч триста пʼятдесят гривень 50 копійок');
    expect(uahAmountInWords(2_101)).toBe('Двадцять одна гривня 01 копійка');
    expect(uahAmountInWords(102)).toBe('Одна гривня 02 копійки');
    expect(uahAmountInWords(100_000_000)).toBe('Один мільйон гривень 00 копійок');
    expect(uahAmountInWords(5)).toBe('Нуль гривень 05 копійок');
  });
});

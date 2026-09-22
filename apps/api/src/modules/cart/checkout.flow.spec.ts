import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertReturnUrlAllowed,
  chooseProvider,
  generateOrderNumber,
  initialOrderStatus,
  resolveFlow,
} from './checkout.flow';

describe('resolveFlow / initialOrderStatus', () => {
  it('B2C — картка, B2B/B2G — рахунок', () => {
    expect(resolveFlow('B2C')).toBe('CARD');
    expect(resolveFlow('B2B')).toBe('INVOICE');
    expect(resolveFlow('B2G')).toBe('INVOICE');
  });

  it('картка чекає оплати, рахунок — виставлено', () => {
    expect(initialOrderStatus('CARD')).toBe('PENDING_PAYMENT');
    expect(initialOrderStatus('INVOICE')).toBe('INVOICED');
  });
});

describe('chooseProvider', () => {
  it('UAH: WayForPay за замовчуванням, LiqPay на вибір', () => {
    expect(chooseProvider('CARD', 'UAH')).toBe('WAYFORPAY');
    expect(chooseProvider('CARD', 'UAH', 'LIQPAY')).toBe('LIQPAY');
  });

  it('інші валюти — лише Stripe', () => {
    expect(chooseProvider('CARD', 'USD')).toBe('STRIPE');
    expect(() => chooseProvider('CARD', 'EUR', 'WAYFORPAY')).toThrow(BadRequestException);
  });

  it('рахунок — завжди BANK_INVOICE, картка для B2B заборонена', () => {
    expect(chooseProvider('INVOICE', 'UAH')).toBe('BANK_INVOICE');
    expect(() => chooseProvider('INVOICE', 'UAH', 'WAYFORPAY')).toThrow(BadRequestException);
  });

  it('B2C не може обрати оплату за рахунком', () => {
    expect(() => chooseProvider('CARD', 'UAH', 'BANK_INVOICE')).toThrow(BadRequestException);
  });
});

describe('generateOrderNumber', () => {
  it('формат VS-YYYYMMDD-XXXXXX (UTC)', () => {
    expect(generateOrderNumber(new Date('2026-09-22T23:30:00Z'), () => 'a1b2c3')).toBe('VS-20260922-A1B2C3');
  });

  it('випадкова частина робить номери унікальними', () => {
    const n = new Set(Array.from({ length: 50 }, () => generateOrderNumber()));
    expect(n.size).toBe(50);
    for (const v of n) expect(v).toMatch(/^VS-\d{8}-[0-9A-F]{6}$/);
  });
});

describe('assertReturnUrlAllowed', () => {
  const allowed = ['http://localhost:3000', 'https://voltstar.ua'];

  it('пропускає URL нашого фронтенду', () => {
    expect(() => assertReturnUrlAllowed('https://voltstar.ua/uk/checkout/result?o=1', allowed)).not.toThrow();
  });

  it('блокує сторонні домени (відкритий редирект) і сміття', () => {
    expect(() => assertReturnUrlAllowed('https://evil.example/phish', allowed)).toThrow(BadRequestException);
    expect(() => assertReturnUrlAllowed('https://voltstar.ua.evil.example/', allowed)).toThrow(BadRequestException);
    expect(() => assertReturnUrlAllowed('not a url', allowed)).toThrow(BadRequestException);
  });
});

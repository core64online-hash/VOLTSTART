import { describe, expect, it } from 'vitest';
import { availableDocuments } from './documents.service';
import { buildDocumentModel, type OrderSnapshot } from './document-model';
import { renderDocumentPdf } from './pdf-renderer';

const seller = { name: 'ТОВ «ВОЛЬТСТАР»', edrpou: '14360570', iban: 'UA213223130000026007233566001' };

const order: OrderSnapshot = {
  number: 'VS-20260922-ABCDEF',
  createdAt: new Date('2026-09-22T10:00:00Z'),
  currency: 'UAH',
  deliveryMethod: 'NOVA_POSHTA',
  deliveryMinor: 15_000,
  contactName: 'Петро',
  contactEmail: 'p@firm.ua',
  contactPhone: '+380671234567',
  organization: { name: 'ТОВ «Тест»', edrpou: '00032129' },
  items: [
    { name: 'Generac GP3300', quantity: 2, unitPriceMinor: 1_700_000, vatRate: 0.2 },
    { name: 'Кабель', quantity: 1, unitPriceMinor: 120_050, vatRate: 0.2 },
  ],
};

describe('buildDocumentModel', () => {
  const model = buildDocumentModel('invoice', order, seller);

  it('рядки: товари + доставка окремим рядком, нетто/ПДВ/брутто', () => {
    expect(model.rows.map((r) => r.name)).toEqual(['Generac GP3300', 'Кабель', 'Доставка «Нова пошта»']);
    expect(model.rows[0]).toMatchObject({ index: 1, quantity: 2, grossMinor: 3_400_000, netMinor: 2_833_333, vatMinor: 566_667 });
    for (const r of model.rows) expect(r.netMinor + r.vatMinor).toBe(r.grossMinor);
  });

  it('підсумки збігаються з сумою рядків і з сумою замовлення', () => {
    expect(model.totals.grossMinor).toBe(3_400_000 + 120_050 + 15_000);
    expect(model.totals.netMinor + model.totals.vatMinor).toBe(model.totals.grossMinor);
    expect(model.amountInWords).toBe('Тридцять пʼять тисяч триста пʼятдесят гривень 50 копійок');
  });

  it('покупець — організація з ЄДРПОУ; для фізособи — імʼя з контакту', () => {
    expect(model.buyer).toMatchObject({ name: 'ТОВ «Тест»', edrpou: '00032129' });
    const b2c = buildDocumentModel('invoice', { ...order, organization: null }, seller);
    expect(b2c.buyer).toMatchObject({ name: 'Петро', edrpou: null });
  });

  it('без доставки — без рядка доставки; не-UAH — без суми прописом', () => {
    const m = buildDocumentModel('delivery-note', { ...order, deliveryMinor: 0, currency: 'USD' }, seller);
    expect(m.rows).toHaveLength(2);
    expect(m.amountInWords).toBeNull();
    expect(m.title).toBe('Видаткова накладна');
  });
});

describe('availableDocuments', () => {
  it('рахунок — завжди (крім скасованих), накладна — з комплектації', () => {
    expect(availableDocuments('INVOICED')).toEqual(['invoice']);
    expect(availableDocuments('PAID')).toEqual(['invoice']);
    expect(availableDocuments('PROCESSING')).toEqual(['invoice', 'delivery-note']);
    expect(availableDocuments('DELIVERED')).toEqual(['invoice', 'delivery-note']);
    expect(availableDocuments('CANCELLED')).toEqual([]);
  });
});

describe('renderDocumentPdf', () => {
  it('генерує валідний PDF (з кириличним шрифтом) з номером у метаданих', async () => {
    const pdf = await renderDocumentPdf(buildDocumentModel('invoice', order, seller));
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('invoice VS-20260922-ABCDEF');
    expect(text).toMatch(/DejaVuSans/);
    expect(pdf.length).toBeGreaterThan(5_000);
  });
});

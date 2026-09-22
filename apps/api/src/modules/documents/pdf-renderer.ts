import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import type { DocumentModel } from './document-model';

/**
 * Шрифти з кирилицею лежать у apps/api/assets/fonts. Шлях відносно цього файлу
 * різний для src/ (ts, vitest) і dist/src/ (зібраний API), тож перевіряємо обидва.
 */
export function resolveFontsDir(): string {
  const candidates = [resolve(__dirname, '../../../assets/fonts'), resolve(__dirname, '../../../../assets/fonts')];
  const found = candidates.find((dir) => existsSync(join(dir, 'DejaVuSans.ttf')));
  if (!found) throw new Error(`Шрифти для PDF не знайдено (шукали: ${candidates.join(', ')})`);
  return found;
}

const money = (minor: number) =>
  (minor / 100).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateUk = (d: Date) =>
  d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Kyiv' });

/** Рендер документа в PDF (A4). Повертає вміст файлу. */
export function renderDocumentPdf(model: DocumentModel, fontsDir: string = resolveFontsDir()): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      // ASCII-заголовок — його видно в метаданих без декодування UTF-16.
      info: { Title: `${model.kind} ${model.number}`, Author: model.seller.name },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('R', join(fontsDir, 'DejaVuSans.ttf'));
    doc.registerFont('B', join(fontsDir, 'DejaVuSans-Bold.ttf'));
    const cur = model.currency === 'UAH' ? 'грн' : model.currency;
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    doc.font('B').fontSize(16).text(`${model.title} № ${model.number}`, { align: 'center' });
    doc.font('R').fontSize(10).text(`від ${dateUk(model.date)}`, { align: 'center' }).moveDown(1.2);

    const party = (label: string, lines: string[]) => {
      doc.font('B').text(label, { continued: true }).font('R').text(` ${lines.filter(Boolean).join('; ')}`);
    };
    party('Постачальник:', [
      model.seller.name,
      model.seller.edrpou && `ЄДРПОУ ${model.seller.edrpou}`,
      model.seller.iban && `IBAN ${model.seller.iban}`,
      model.seller.address ?? '',
    ]);
    party('Покупець:', [model.buyer.name, model.buyer.edrpou ? `ЄДРПОУ ${model.buyer.edrpou}` : '', model.buyer.contact]);
    doc.moveDown(1);

    // Таблиця: №, найменування, к-сть, ціна без ПДВ, сума без ПДВ, ПДВ, разом.
    const cols = [
      { title: '№', w: 24, align: 'center' as const },
      { title: 'Найменування', w: width - 24 - 40 - 72 * 4, align: 'left' as const },
      { title: 'К-сть', w: 40, align: 'right' as const },
      { title: 'Ціна без ПДВ', w: 72, align: 'right' as const },
      { title: 'Сума без ПДВ', w: 72, align: 'right' as const },
      { title: 'ПДВ', w: 72, align: 'right' as const },
      { title: 'Разом', w: 72, align: 'right' as const },
    ];
    const drawRow = (cells: string[], bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'B' : 'R').fontSize(9);
      let x = left;
      const heights = cells.map((c, i) => doc.heightOfString(c, { width: cols[i].w - 6 }));
      const h = Math.max(...heights) + 6;
      if (y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const top = doc.y;
      cells.forEach((c, i) => {
        doc.rect(x, top, cols[i].w, h).stroke('#999999');
        doc.fillColor('#000000').text(c, x + 3, top + 3, { width: cols[i].w - 6, align: cols[i].align });
        x += cols[i].w;
      });
      doc.x = left;
      doc.y = top + h;
    };

    drawRow(cols.map((c) => c.title), true);
    for (const r of model.rows) {
      drawRow([
        String(r.index),
        r.name,
        String(r.quantity),
        money(r.unitNetMinor),
        money(r.netMinor),
        money(r.vatMinor),
        money(r.grossMinor),
      ]);
    }

    doc.moveDown(1).font('R').fontSize(10);
    const total = (label: string, value: number, bold = false) =>
      doc.font(bold ? 'B' : 'R').text(`${label}: ${money(value)} ${cur}`, left, doc.y, { width, align: 'right' });
    total('Разом без ПДВ', model.totals.netMinor);
    total('ПДВ', model.totals.vatMinor);
    total('Всього з ПДВ', model.totals.grossMinor, true);

    if (model.amountInWords) {
      doc.moveDown(0.8).font('R').text(`Всього на суму: ${model.amountInWords}, у т.ч. ПДВ ${money(model.totals.vatMinor)} ${cur}.`, left, doc.y, { width });
    }
    if (model.kind === 'invoice') {
      doc.moveDown(0.8).text(`Призначення платежу: Оплата за рахунком № ${model.number}, у т.ч. ПДВ.`, { width });
    }

    doc.moveDown(2.5);
    const sign = (label: string) => doc.text(`${label} ____________________`, { width });
    sign('Від постачальника:');
    if (model.kind === 'delivery-note') sign('Отримав(ла):');

    doc.end();
  });
}

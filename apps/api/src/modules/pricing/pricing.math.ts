export interface QuoteInput {
  /** Ціна за одиницю з ПДВ (брутто), мінімальні одиниці. */
  unitGrossMinor: number;
  /** Ставка ПДВ, частка (напр. 0.2). */
  vatRate: number;
  quantity: number;
}

export interface QuoteBreakdown {
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
}

/**
 * Розкладає вартість позиції на нетто/ПДВ/брутто.
 * Конвенція: збережена ціна — з ПДВ (брутто) за одиницю; нетто виділяється зворотним ходом.
 */
export function splitGross({ unitGrossMinor, vatRate, quantity }: QuoteInput): QuoteBreakdown {
  const grossMinor = unitGrossMinor * quantity;
  const netMinor = Math.round(grossMinor / (1 + vatRate));
  const vatMinor = grossMinor - netMinor;
  return { netMinor, vatMinor, grossMinor };
}

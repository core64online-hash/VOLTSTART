import { z } from 'zod';
import { CurrencySchema, SegmentSchema } from './enums';

/** Запит ціни на товар для сегмента/валюти. */
export const PriceQuerySchema = z.object({
  productId: z.string().min(1),
  segment: SegmentSchema.default('B2C'),
  currency: CurrencySchema.default('UAH'),
  quantity: z.number().int().positive().default(1),
});
export type PriceQuery = z.infer<typeof PriceQuerySchema>;

/**
 * Розкладка вартості позиції: нетто + ПДВ + брутто (у мінімальних одиницях).
 * Конвенція: збережена ціна (`unitGrossMinor`) — з ПДВ (брутто) за одиницю.
 */
export const PriceQuoteSchema = z.object({
  productId: z.string(),
  segment: SegmentSchema,
  currency: CurrencySchema,
  quantity: z.number().int().positive(),
  /** Ціна за одиницю з ПДВ, мінімальні одиниці (копійки/центи). */
  unitGrossMinor: z.number().int().nonnegative(),
  /** Ставка ПДВ, частка (напр. 0.2). */
  vatRate: z.number().min(0).max(1),
  /** Разом без ПДВ. */
  netMinor: z.number().int().nonnegative(),
  /** Сума ПДВ. */
  vatMinor: z.number().int().nonnegative(),
  /** Разом із ПДВ. */
  grossMinor: z.number().int().nonnegative(),
});
export type PriceQuote = z.infer<typeof PriceQuoteSchema>;

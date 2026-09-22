import { z } from 'zod';
import { FuelTypeSchema, LoadTypeSchema, PhaseTypeSchema } from './selector';
import { CurrencySchema, SegmentSchema } from './enums';

/** Ціна для конкретного сегмента та валюти. */
export const PriceSchema = z.object({
  segment: SegmentSchema,
  currency: CurrencySchema,
  /** Ціна в мінімальних одиницях (копійки/центи) для точності. */
  amountMinor: z.number().int().nonnegative(),
  /** Ставка ПДВ, частка (напр. 0.2). */
  vatRate: z.number().min(0).max(1).default(0.2),
});
export type Price = z.infer<typeof PriceSchema>;

/** Публічне подання генератора в каталозі. */
export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  categorySlug: z.string(),
  fuel: FuelTypeSchema,
  phase: PhaseTypeSchema,
  /** Номінальна (робоча) потужність, Вт. */
  ratedPowerW: z.number().positive(),
  /** Максимальна (пікова) потужність, Вт. */
  maxPowerW: z.number().positive(),
  images: z.array(z.string()).default([]),
  inStock: z.boolean().default(true),
  prices: z.array(PriceSchema).default([]),
});
export type Product = z.infer<typeof ProductSchema>;

/** Параметри фасетного пошуку каталогу. */
export const CatalogQuerySchema = z.object({
  q: z.string().optional(),
  brand: z.array(z.string()).optional(),
  fuel: z.array(FuelTypeSchema).optional(),
  phase: PhaseTypeSchema.optional(),
  minPowerW: z.number().optional(),
  maxPowerW: z.number().optional(),
  inStock: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(24),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

/** Доступні значення фасетів для фільтрів каталогу. */
export const CatalogFacetsSchema = z.object({
  brands: z.array(z.object({ slug: z.string(), name: z.string() })),
  fuels: z.array(FuelTypeSchema),
});
export type CatalogFacets = z.infer<typeof CatalogFacetsSchema>;

/** Пресет типової техніки для форми підбору. */
export const EquipmentPresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  powerW: z.number().int().positive(),
  loadType: LoadTypeSchema,
  category: z.string().nullable().optional(),
});
export type EquipmentPreset = z.infer<typeof EquipmentPresetSchema>;

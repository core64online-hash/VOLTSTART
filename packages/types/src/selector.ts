import { z } from 'zod';

/** Тип електричного навантаження (впливає на пусковий струм). */
export const LoadType = {
  /** Резистивне: лампи розжарювання, ТЕНи, обігрівачі. Пусковий коеф. ≈ 1. */
  RESISTIVE: 'RESISTIVE',
  /** Індуктивне: холодильники, насоси, кондиціонери (АС-двигуни). */
  INDUCTIVE: 'INDUCTIVE',
  /** Двигуни з прямим пуском: компресори, верстати. Високі пускові струми. */
  MOTOR: 'MOTOR',
  /** Електроніка / імпульсні БЖ: ПК, зарядні станції. */
  ELECTRONIC: 'ELECTRONIC',
} as const;
export const LoadTypeSchema = z.nativeEnum(LoadType);
export type LoadType = (typeof LoadType)[keyof typeof LoadType];

/** Фазність мережі. */
export const PhaseType = {
  SINGLE: 'SINGLE', // 1 фаза, 230 В
  THREE: 'THREE', // 3 фази, 400 В
} as const;
export const PhaseTypeSchema = z.nativeEnum(PhaseType);
export type PhaseType = (typeof PhaseType)[keyof typeof PhaseType];

/** Тип палива генератора. */
export const FuelType = {
  PETROL: 'PETROL',
  DIESEL: 'DIESEL',
  GAS: 'GAS',
  DUAL_FUEL: 'DUAL_FUEL',
  INVERTER: 'INVERTER',
} as const;
export const FuelTypeSchema = z.nativeEnum(FuelType);
export type FuelType = (typeof FuelType)[keyof typeof FuelType];

/** Режим використання генератора. */
export const UsageMode = {
  BACKUP: 'BACKUP', // резервне живлення
  PRIME: 'PRIME', // основне джерело
  MOBILE: 'MOBILE', // мобільне / виїзне
} as const;
export const UsageModeSchema = z.nativeEnum(UsageMode);
export type UsageMode = (typeof UsageMode)[keyof typeof UsageMode];

/** Один споживач у списку навантаження. */
export const LoadItemSchema = z.object({
  /** Назва техніки (напр. «Холодильник»). */
  label: z.string().min(1),
  /** Номінальна потужність одиниці, Вт. */
  powerW: z.number().positive(),
  /** Кількість одиниць. */
  quantity: z.number().int().positive().default(1),
  /** Тип навантаження. */
  loadType: LoadTypeSchema,
  /** Чи запускаються одночасно (впливає на облік пускових струмів). */
  simultaneousStart: z.boolean().default(false),
});
export type LoadItem = z.infer<typeof LoadItemSchema>;

/** Вхідні дані форми підбору генератора. */
export const SelectorInputSchema = z.object({
  items: z.array(LoadItemSchema).min(1, 'Додайте хоча б одного споживача'),
  phase: PhaseTypeSchema.default('SINGLE'),
  /** Бажаний запас потужності (частка), напр. 0.2 = 20%. */
  reserveFactor: z.number().min(0).max(1).default(0.2),
  usageMode: UsageModeSchema.default('BACKUP'),
  /** Уподобання за паливом (для ранжування, необовʼязково). */
  preferredFuel: z.array(FuelTypeSchema).optional(),
});
export type SelectorInput = z.infer<typeof SelectorInputSchema>;

/** Результат розрахунку потужності. */
export const PowerCalculationSchema = z.object({
  /** Сумарна номінальна (робоча) потужність, Вт. */
  runningW: z.number(),
  /** Пікова потужність з урахуванням пускових струмів, Вт. */
  peakW: z.number(),
  /** Рекомендована номінальна потужність генератора із запасом, Вт. */
  recommendedW: z.number(),
  /** Рекомендована повна потужність, кВА (при cosφ = 0.8). */
  recommendedKva: z.number(),
  phase: PhaseTypeSchema,
});
export type PowerCalculation = z.infer<typeof PowerCalculationSchema>;

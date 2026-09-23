import { z } from 'zod';
import { OrgTypeSchema, RoleSchema, SegmentSchema } from './enums';

/** Пароль: мінімальні вимоги для MVP. */
export const PasswordSchema = z
  .string()
  .min(8, 'Пароль має містити щонайменше 8 символів')
  .max(128);

/** Дані організації при реєстрації B2B/B2G. */
export const OrganizationInputSchema = z.object({
  name: z.string().min(2, 'Вкажіть назву організації'),
  type: OrgTypeSchema.default('BUSINESS'),
  segment: SegmentSchema.default('B2B'),
  /** Код ЄДРПОУ (8 цифр) — для BUSINESS/GOVERNMENT. */
  edrpou: z.string().optional(),
  /** Індивідуальний податковий номер / VAT. */
  vatNumber: z.string().optional(),
});
export type OrganizationInput = z.infer<typeof OrganizationInputSchema>;

/** Реєстрація користувача (опційно — з організацією для B2B/B2G). */
export const RegisterInputSchema = z.object({
  email: z.string().email('Некоректний email'),
  password: PasswordSchema,
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  organization: OrganizationInputSchema.optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/** Логін за email + пароль. */
export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Публічне подання організації. */
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: OrgTypeSchema,
  segment: SegmentSchema,
  edrpou: z.string().nullable(),
  vatNumber: z.string().nullable(),
  verified: z.boolean(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

/** Публічний профіль користувача (без паролю). */
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  role: RoleSchema,
  /** Сегмент клієнта: B2C для фізосіб, інакше — сегмент організації. */
  segment: SegmentSchema,
  organization: OrganizationSchema.nullable(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

/** Результат автентифікації: токен доступу + профіль. */
export const AuthResultSchema = z.object({
  accessToken: z.string(),
  /** Час життя токена, секунди. */
  expiresIn: z.number().int().positive(),
  user: AuthUserSchema,
});
export type AuthResult = z.infer<typeof AuthResultSchema>;

/** Корисне навантаження JWT (claims). */
export const JwtPayloadSchema = z.object({
  /** subject — id користувача. */
  sub: z.string(),
  email: z.string(),
  role: RoleSchema,
  segment: SegmentSchema,
  orgId: z.string().nullable().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

/** Видалення власного акаунта — з підтвердженням паролем. */
export const DeleteAccountSchema = z.object({ password: z.string().min(1, 'Введіть пароль') });
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;

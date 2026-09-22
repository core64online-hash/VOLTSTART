import type { AuthResult, AuthUser, LoginInput, RegisterInput } from '@voltstar/types';
import { apiUrl } from './api';

const TOKEN_KEY = 'voltstar_token';

/** Зберігає access-токен у localStorage (ігнорує помилки приватного режиму). */
export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage недоступний — ігноруємо */
  }
}

/** Повертає збережений токен або null. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Видаляє токен (вихід). */
export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown };
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
  } catch {
    /* тіло не JSON */
  }
  return `Помилка запиту (${res.status})`;
}

/** Реєстрація користувача. */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const res = await fetch(apiUrl('/accounts/register'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Логін за email + паролем. */
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const res = await fetch(apiUrl('/accounts/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Профіль поточного користувача за токеном. */
export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(apiUrl('/accounts/me'), {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Запит листа зі скиданням паролю (відповідь однакова для будь-якого email). */
export async function requestPasswordReset(email: string, locale: string): Promise<void> {
  const res = await fetch(apiUrl('/accounts/password/forgot'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, locale }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

/** Новий пароль за токеном із листа. */
export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(apiUrl('/accounts/password/reset'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

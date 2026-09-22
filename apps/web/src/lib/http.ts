import { apiUrl } from './api';
import { getToken } from './auth';

/** Помилка API з HTTP-статусом (щоб відрізняти «не знайдено» від збою мережі). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown };
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
  } catch {
    /* тіло не JSON */
  }
  return `Помилка запиту (${res.status})`;
}

/** Запит до API з токеном користувача (якщо є). Кидає ApiError за не-2xx. */
export async function apiFetch(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
  return res;
}

export async function apiJson<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}

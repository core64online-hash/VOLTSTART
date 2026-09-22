import type { OrderDetail, OrderDocumentKind, OrderSummary } from '@voltstar/types';
import { apiFetch, apiJson } from './http';

const emailQuery = (email?: string | null) => (email ? `?email=${encodeURIComponent(email)}` : '');

/** Історія замовлень поточного користувача. */
export function fetchMyOrders(): Promise<OrderSummary[]> {
  return apiJson<OrderSummary[]>('/orders');
}

/** Деталі замовлення: для власника — за токеном, для гостя — за email із замовлення. */
export function fetchOrder(number: string, email?: string | null): Promise<OrderDetail> {
  return apiJson<OrderDetail>(`/orders/${encodeURIComponent(number)}${emailQuery(email)}`);
}

/**
 * Завантаження PDF. Запит іде з Authorization-заголовком, тож звичайне посилання
 * не підходить — забираємо blob і зберігаємо через тимчасовий object URL.
 */
export async function downloadDocument(number: string, kind: OrderDocumentKind, email?: string | null): Promise<void> {
  const res = await apiFetch(`/orders/${encodeURIComponent(number)}/documents/${kind}${emailQuery(email)}`);
  const blob = await res.blob();
  const filename =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${kind}-${number}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

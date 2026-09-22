import type { Cart, CheckoutInput, CheckoutResult, DeliveryMethod } from '@voltstar/types';
import { ApiError, apiJson } from './http';

export { ApiError } from './http';

const CART_KEY = 'voltstar_cart';
const LAST_ORDER_KEY = 'voltstar_last_order';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const getCartId = (): string | null => storage()?.getItem(CART_KEY) ?? null;
const setCartId = (id: string) => storage()?.setItem(CART_KEY, id);
export const clearCartId = () => storage()?.removeItem(CART_KEY);

const request = apiJson;

/** Поточний кошик; якщо збережений id протух (404/403) — створюємо новий. */
export async function loadCart(delivery?: DeliveryMethod): Promise<Cart> {
  const id = getCartId();
  if (id) {
    try {
      return await request<Cart>(`/cart/${id}${delivery ? `?delivery=${delivery}` : ''}`);
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 403)) throw e;
      clearCartId();
    }
  }
  const cart = await request<Cart>('/cart', { method: 'POST', body: {} });
  setCartId(cart.id);
  return cart;
}

export async function addToCart(productId: string, quantity = 1): Promise<Cart> {
  const cart = await loadCart();
  return request<Cart>(`/cart/${cart.id}/items`, { method: 'POST', body: { productId, quantity } });
}

export function updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
  return request<Cart>(`/cart/${cartId}/items/${itemId}`, { method: 'PATCH', body: { quantity } });
}

export function removeCartItem(cartId: string, itemId: string): Promise<Cart> {
  return request<Cart>(`/cart/${cartId}/items/${itemId}`, { method: 'DELETE' });
}

/** Оформлення; після успіху кошик на сервері видалено — забуваємо його id. */
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const result = await request<CheckoutResult>('/checkout', { method: 'POST', body: input });
  clearCartId();
  try {
    window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(result));
  } catch {
    /* sessionStorage недоступний — сторінка результату покаже загальне повідомлення */
  }
  return result;
}

/** Останнє оформлене замовлення (для сторінки результату після редиректу з оплати). */
export function lastOrder(): CheckoutResult | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as CheckoutResult) : null;
  } catch {
    return null;
  }
}

/**
 * Переводить покупця на сторінку оплати: WayForPay/LiqPay чекають POST-форму,
 * Stripe — звичайний перехід за URL.
 */
export function redirectToPayment(payment: CheckoutResult['payment']): boolean {
  if (!payment.redirectUrl) return false;
  if (!payment.formFields) {
    window.location.assign(payment.redirectUrl);
    return true;
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payment.redirectUrl;
  form.acceptCharset = 'utf-8';
  for (const [name, value] of Object.entries(payment.formFields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  return true;
}

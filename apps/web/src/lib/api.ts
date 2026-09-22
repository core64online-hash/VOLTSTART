import type {
  CatalogFacets,
  EquipmentPreset,
  PowerCalculation,
  Product,
  SelectorInput,
} from '@voltstar/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Повний URL до ендпоінта API (усі маршрути під префіксом /api). */
export const apiUrl = (path: string): string => `${API_BASE}/api${path}`;

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
}

/** Список товарів каталогу. Кидає помилку при неуспішній відповіді. */
export async function fetchProducts(
  search: Record<string, string | undefined>,
): Promise<ProductListResult> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (v) qs.set(k, v);
  const res = await fetch(apiUrl(`/catalog/products?${qs.toString()}`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`catalog request failed: ${res.status}`);
  return res.json();
}

/** Один товар за slug. */
export async function fetchProduct(slug: string, segment = 'B2C'): Promise<Product> {
  const res = await fetch(apiUrl(`/catalog/products/${slug}?segment=${segment}`), {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`product request failed: ${res.status}`);
  return res.json();
}

/** Доступні бренди та типи палива для фільтрів каталогу. */
export async function fetchFacets(): Promise<CatalogFacets> {
  const res = await fetch(apiUrl('/catalog/facets'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`facets request failed: ${res.status}`);
  return res.json();
}

/** Пресети типової техніки для форми підбору. */
export async function fetchPresets(): Promise<EquipmentPreset[]> {
  const res = await fetch(apiUrl('/catalog/equipment-presets'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`presets request failed: ${res.status}`);
  return res.json();
}

/** Розрахунок потужності генератора за формою підбору. */
export async function calculatePower(input: SelectorInput): Promise<PowerCalculation> {
  const res = await fetch(apiUrl('/selector/calculate'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`selector request failed: ${res.status}`);
  return res.json();
}

/** Форматування ціни з мінімальних одиниць (копійки) у рядок з валютою. */
export function formatPrice(amountMinor: number, currency: string, locale = 'uk-UA'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100);
}

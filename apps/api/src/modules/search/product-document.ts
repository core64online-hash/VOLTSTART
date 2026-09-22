import type { CatalogQuery } from '@voltstar/types';
import type { CollectionField, SearchParams } from './typesense.client';

/** Аліас, через який API читає/пише індекс; фізичні колекції — products_<версія>. */
export const PRODUCTS_ALIAS = 'products';

/** Документ товару в пошуковому індексі. */
export interface ProductDocument {
  id: string;
  slug: string;
  name: string;
  description?: string;
  brand: string;
  brandSlug: string;
  categorySlug: string;
  fuel: string;
  phase: string;
  ratedPowerW: number;
  maxPowerW: number;
  inStock: boolean;
}

export const PRODUCT_FIELDS: CollectionField[] = [
  { name: 'slug', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'description', type: 'string', optional: true },
  { name: 'brand', type: 'string', facet: true },
  { name: 'brandSlug', type: 'string', facet: true },
  { name: 'categorySlug', type: 'string', facet: true },
  { name: 'fuel', type: 'string', facet: true },
  { name: 'phase', type: 'string', facet: true },
  { name: 'ratedPowerW', type: 'int32', facet: true, sort: true },
  { name: 'maxPowerW', type: 'int32' },
  { name: 'inStock', type: 'bool', facet: true },
];

export const PRODUCT_DEFAULT_SORT = 'ratedPowerW';

/** Мінімальна форма товару з Prisma, потрібна для індексу. */
export interface IndexableProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: { name: string; slug: string };
  category: { slug: string };
  fuel: string;
  phase: string;
  ratedPowerW: number;
  maxPowerW: number;
  inventory: { quantity: number } | null;
}

export function toProductDocument(p: IndexableProduct): ProductDocument {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    brand: p.brand.name,
    brandSlug: p.brand.slug,
    categorySlug: p.category.slug,
    fuel: p.fuel,
    phase: p.phase,
    ratedPowerW: p.ratedPowerW,
    maxPowerW: p.maxPowerW,
    inStock: (p.inventory?.quantity ?? 0) > 0,
  };
}

/** Рядкове значення у filter_by — у зворотних лапках, щоб коми/пробіли/дужки не ламали синтаксис. */
function quote(value: string): string {
  return '`' + value.replace(/`/g, '') + '`';
}

/** Фільтри каталогу → filter_by Typesense (ті самі, що й у Postgres-запиті). */
export function buildFilterBy(q: CatalogQuery): string | undefined {
  const parts: string[] = [];
  if (q.brand?.length) parts.push(`brandSlug:=[${q.brand.map(quote).join(',')}]`);
  if (q.fuel?.length) parts.push(`fuel:=[${q.fuel.map(quote).join(',')}]`);
  if (q.phase) parts.push(`phase:=${quote(q.phase)}`);
  if (q.minPowerW != null) parts.push(`ratedPowerW:>=${Math.floor(q.minPowerW)}`);
  if (q.maxPowerW != null) parts.push(`ratedPowerW:<=${Math.floor(q.maxPowerW)}`);
  if (q.inStock) parts.push('inStock:=true');
  return parts.length ? parts.join(' && ') : undefined;
}

/**
 * Параметри пошуку. Без тексту — «*» (усі документи) з тим самим сортуванням за
 * потужністю, що й у Postgres; з текстом — за релевантністю (стійко до опечаток).
 */
export function buildSearchParams(q: CatalogQuery): SearchParams {
  const text = q.q?.trim();
  return {
    q: text || '*',
    query_by: 'name,brand,description',
    query_by_weights: '4,2,1',
    filter_by: buildFilterBy(q),
    sort_by: text ? '_text_match:desc,ratedPowerW:asc' : 'ratedPowerW:asc',
    page: q.page,
    per_page: q.perPage,
  };
}

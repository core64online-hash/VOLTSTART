import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FuelType, PhaseType, type CatalogFacets, type Product } from '@voltstar/types';
import { fetchFacets, fetchProducts, formatPrice } from '../../../lib/api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations('catalog');

  const filters = {
    q: str(sp.q),
    brand: str(sp.brand),
    fuel: str(sp.fuel),
    phase: str(sp.phase),
    inStock: str(sp.inStock),
    perPage: '24',
  };

  let products: Product[] = [];
  let facets: CatalogFacets = { brands: [], fuels: [] };
  try {
    const [list, f] = await Promise.all([fetchProducts(filters), fetchFacets()]);
    products = list.items;
    facets = f;
  } catch {
    // API/БД недоступні — показуємо порожній стан і фільтри з енумів.
  }

  const fuelOptions = facets.fuels.length ? facets.fuels : Object.values(FuelType);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link href={`/${locale}`} className="text-sm text-neutral-500 hover:underline">
        VOLTSTAR
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-bold">{t('title')}</h1>

      {/* Фасетні фільтри (GET-форма, без клієнтського JS) */}
      <form
        action={`/${locale}/catalog`}
        method="get"
        className="mb-8 grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder={t('filters.search')}
          className="rounded border px-2 py-1 lg:col-span-2"
        />
        <select name="brand" defaultValue={filters.brand ?? ''} className="rounded border px-2 py-1">
          <option value="">{t('filters.brand')}: {t('filters.all')}</option>
          {facets.brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="fuel" defaultValue={filters.fuel ?? ''} className="rounded border px-2 py-1">
          <option value="">{t('filters.fuel')}: {t('filters.all')}</option>
          {fuelOptions.map((f) => (
            <option key={f} value={f}>
              {t(`fuels.${f}`)}
            </option>
          ))}
        </select>
        <select name="phase" defaultValue={filters.phase ?? ''} className="rounded border px-2 py-1">
          <option value="">{t('filters.phase')}: {t('filters.all')}</option>
          {Object.values(PhaseType).map((p) => (
            <option key={p} value={p}>
              {t(`phases.${p}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inStock" value="true" defaultChecked={filters.inStock === 'true'} />
          {t('filters.inStock')}
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300">
            {t('filters.apply')}
          </button>
          <Link href={`/${locale}/catalog`} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
            {t('filters.reset')}
          </Link>
        </div>
      </form>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-neutral-500">
          {t('empty')}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const price = p.prices[0];
            return (
              <Link
                key={p.id}
                href={`/${locale}/catalog/${p.slug}`}
                className="flex flex-col rounded-xl border border-neutral-200 p-5 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {p.brand}
                </span>
                <span className="mt-1 text-lg font-semibold">{p.name}</span>
                <span className="mt-2 text-sm text-neutral-600">
                  {t('power')}: {(p.ratedPowerW / 1000).toFixed(1)} кВт · {t('fuel')}: {t(`fuels.${p.fuel}`)}
                </span>
                <span className="mt-3 text-sm">
                  {p.inStock ? (
                    <span className="text-green-600">{t('inStock')}</span>
                  ) : (
                    <span className="text-neutral-400">{t('outOfStock')}</span>
                  )}
                </span>
                {price && (
                  <span className="mt-3 text-lg font-bold text-brand-dark">
                    {t('from')} {formatPrice(price.amountMinor, price.currency, `${locale}-UA`)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Product } from '@voltstar/types';
import { fetchProduct, formatPrice } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('catalog');

  let product: Product | null = null;
  try {
    product = await fetchProduct(slug);
  } catch {
    product = null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/${locale}/catalog`} className="text-sm text-neutral-500 hover:underline">
        {t('backToCatalog')}
      </Link>

      {!product ? (
        <p className="mt-6 rounded-lg border border-dashed border-neutral-300 p-6 text-neutral-500">
          {t('notFound')}
        </p>
      ) : (
        <article className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {product.brand}
          </span>
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Spec label={t('power')} value={`${(product.ratedPowerW / 1000).toFixed(1)} кВт`} />
            <Spec label="Max" value={`${(product.maxPowerW / 1000).toFixed(1)} кВт`} />
            <Spec label={t('phase')} value={product.phase} />
            <Spec label={t('fuel')} value={product.fuel} />
          </dl>

          <p className="mt-6 text-sm">
            {product.inStock ? (
              <span className="text-green-600">{t('inStock')}</span>
            ) : (
              <span className="text-neutral-400">{t('outOfStock')}</span>
            )}
          </p>

          {product.prices[0] && (
            <p className="mt-4 text-2xl font-bold text-brand-dark">
              {formatPrice(product.prices[0].amountMinor, product.prices[0].currency, `${locale}-UA`)}
            </p>
          )}
        </article>
      )}
    </main>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

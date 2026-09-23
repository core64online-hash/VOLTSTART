import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Product } from '@voltstar/types';
import { fetchProduct, formatPrice } from '../../../../lib/api';
import { jsonLd, localizedUrl, pageMetadata, SITE_NAME } from '../../../../lib/seo';
import { AddToCartButton } from './add-to-cart';

// ISR: сторінка товару рендериться при першому запиті й оновлюється раз на хвилину.
export const revalidate = 60;
// Порожній список: жодної сторінки під час збірки, кожна генерується при першому запиті й кешується.
export const generateStaticParams = () => [];

type Params = { params: Promise<{ locale: string; slug: string }> };

/** Товар або null; збій API не маскуємо під 404 — Next покаже сторінку помилки. */
const load = (slug: string) => fetchProduct(slug);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await load(slug);
  if (!product) return {};
  const [t, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'catalog' }),
    getTranslations({ locale, namespace: 'seo' }),
  ]);
  const price = product.prices[0];
  return pageMetadata({
    locale,
    path: `/catalog/${product.slug}`,
    title: product.name,
    description: seo('product', {
      name: product.name,
      brand: product.brand,
      power: (product.ratedPowerW / 1000).toFixed(1),
      fuel: t(`fuels.${product.fuel}`),
      phase: t(`phases.${product.phase}`),
      price: price ? seo('price', { price: formatPrice(price.amountMinor, price.currency, `${locale}-UA`) }) : '',
    }),
    image: product.images[0],
  });
}

export default async function ProductPage({ params }: Params) {
  const { locale, slug } = await params;
  // Статичний рендер/ISR: мова з параметра маршруту, а не із заголовків запиту.
  setRequestLocale(locale);
  const product = await load(slug);
  if (!product) notFound();
  const t = await getTranslations('catalog');
  const price = product.prices[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productJsonLd(product, locale))} />
      <nav aria-label={t('breadcrumbs')} className="text-sm text-neutral-600">
        <Link href={`/${locale}/catalog`} className="hover:underline">
          {t('backToCatalog')}
        </Link>
      </nav>

      <article className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{product.brand}</span>
        <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>

        {product.images[0] && (
          // Зовнішні URL з адмінки; розміри задані, щоб не було зсуву макета.
          <img
            src={product.images[0]}
            alt={product.name}
            width={768}
            height={512}
            fetchPriority="high"
            className="mt-6 aspect-[3/2] w-full rounded-xl bg-neutral-100 object-contain"
          />
        )}

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <Spec label={t('power')} value={`${(product.ratedPowerW / 1000).toFixed(1)} кВт`} />
          <Spec label={t('maxPower')} value={`${(product.maxPowerW / 1000).toFixed(1)} кВт`} />
          <Spec label={t('phase')} value={t(`phases.${product.phase}`)} />
          <Spec label={t('fuel')} value={t(`fuels.${product.fuel}`)} />
        </dl>

        <p className="mt-6 text-sm">
          {product.inStock ? (
            <span className="text-green-700">{t('inStock')}</span>
          ) : (
            <span className="text-neutral-600">{t('outOfStock')}</span>
          )}
        </p>

        {price && (
          <p className="mt-4 text-2xl font-bold text-brand-dark">
            {formatPrice(price.amountMinor, price.currency, `${locale}-UA`)}
          </p>
        )}

        <AddToCartButton productId={product.id} disabled={!product.inStock || !price} />
      </article>
    </main>
  );
}

function productJsonLd(product: Product, locale: string) {
  const url = localizedUrl(locale, `/catalog/${product.slug}`);
  const price = product.prices[0];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.slug,
      url,
      ...(product.images.length ? { image: product.images } : {}),
      brand: { '@type': 'Brand', name: product.brand },
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'ratedPower', value: product.ratedPowerW, unitCode: 'WTT' },
        { '@type': 'PropertyValue', name: 'maxPower', value: product.maxPowerW, unitCode: 'WTT' },
      ],
      ...(price
        ? {
            offers: {
              '@type': 'Offer',
              url,
              price: (price.amountMinor / 100).toFixed(2),
              priceCurrency: price.currency,
              availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              seller: { '@type': 'Organization', name: SITE_NAME },
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: localizedUrl(locale) },
        { '@type': 'ListItem', position: 2, name: locale === 'en' ? 'Catalog' : 'Каталог', item: localizedUrl(locale, '/catalog') },
        { '@type': 'ListItem', position: 3, name: product.name, item: url },
      ],
    },
  ];
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <dt className="text-xs text-neutral-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

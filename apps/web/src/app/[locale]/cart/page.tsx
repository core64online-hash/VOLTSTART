import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CartView } from './cart-view';

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('cart');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/${locale}/catalog`} className="text-sm text-neutral-500 hover:underline">
        {t('toCatalog')}
      </Link>
      <h1 className="mt-2 mb-8 text-3xl font-bold">{t('title')}</h1>
      <CartView />
    </main>
  );
}

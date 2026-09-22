import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { OrderView } from './order-view';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, number } = await params;
  const sp = await searchParams;
  const email = typeof sp.email === 'string' ? sp.email : undefined;
  const t = await getTranslations('orders');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/${locale}/account`} className="text-sm text-neutral-500 hover:underline">
        ← {t('backToAccount')}
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-bold">{t('title', { number: decodeURIComponent(number) })}</h1>
      <OrderView number={decodeURIComponent(number)} email={email} />
    </main>
  );
}

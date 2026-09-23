import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResultView } from './result-view';
import { NO_INDEX } from '../../../../lib/seo';

/** Службова сторінка — не для пошукових систем. */
export const metadata = NO_INDEX;

export default async function CheckoutResultPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('cart.result');

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t('title')}</h1>
      <ResultView />
    </main>
  );
}

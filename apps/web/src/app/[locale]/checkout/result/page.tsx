import { getTranslations } from 'next-intl/server';
import { ResultView } from './result-view';

export default async function CheckoutResultPage() {
  const t = await getTranslations('cart.result');

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t('title')}</h1>
      <ResultView />
    </main>
  );
}

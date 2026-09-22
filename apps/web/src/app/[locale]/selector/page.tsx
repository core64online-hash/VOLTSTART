import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SelectorForm } from './selector-form';

export default async function SelectorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('selector');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/${locale}`} className="text-sm text-neutral-500 hover:underline">
        VOLTSTAR
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mb-8 mt-2 text-neutral-600">{t('subtitle')}</p>
      <SelectorForm />
    </main>
  );
}

import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SelectorForm } from './selector-form';
import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, seo] = await Promise.all([getTranslations({ locale, namespace: 'selector' }), getTranslations({ locale, namespace: 'seo' })]);
  return pageMetadata({ locale, path: '/selector', title: t('title'), description: seo('selector') });
}


export default async function SelectorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Статичний рендер/ISR: мова з параметра маршруту, а не із заголовків запиту.
  setRequestLocale(locale);
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

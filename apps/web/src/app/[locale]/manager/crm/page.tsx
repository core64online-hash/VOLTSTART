import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CrmView } from './crm-view';

export default async function CrmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('crm');

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <Link href={`/${locale}`} className="text-sm text-neutral-500 hover:underline">
        VOLTSTAR
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-bold">{t('title')}</h1>
      <CrmView />
    </main>
  );
}

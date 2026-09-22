import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AccountView } from './account-view';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/${locale}`} className="text-sm text-neutral-500 hover:underline">
        VOLTSTAR
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{t('profile.title')}</h1>
      <p className="mb-8 mt-2 text-neutral-600">{t('profile.subtitle')}</p>
      <AccountView />
    </main>
  );
}

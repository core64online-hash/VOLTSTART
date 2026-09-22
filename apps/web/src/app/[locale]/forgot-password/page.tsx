import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ForgotForm } from './forgot-form';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href={`/${locale}/login`} className="text-sm text-neutral-500 hover:underline">
        ← {t('login.title')}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{t('forgot.title')}</h1>
      <p className="mb-8 mt-2 text-neutral-600">{t('forgot.subtitle')}</p>
      <ForgotForm />
    </main>
  );
}

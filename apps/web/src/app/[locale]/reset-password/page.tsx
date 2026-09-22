import { getTranslations } from 'next-intl/server';
import { ResetForm } from './reset-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{t('reset.title')}</h1>
      <p className="mb-8 mt-2 text-neutral-600">{t('reset.subtitle')}</p>
      <ResetForm token={token} />
    </main>
  );
}

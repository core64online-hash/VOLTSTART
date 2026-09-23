'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { reportClientError } from '../../lib/error-reporting';

/** Помилка рендеру сторінки: зрозуміле повідомлення замість стандартного екрана Next.js + звіт у Sentry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errorPage');
  const locale = useLocale();
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-3 text-neutral-600">{t('text')}</p>
      {error.digest && <p className="mt-2 text-xs text-neutral-500">ID: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
          {t('retry')}
        </button>
        <Link href={`/${locale}`} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}

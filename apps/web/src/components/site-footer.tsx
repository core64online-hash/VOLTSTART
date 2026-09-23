'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { openConsentSettings } from '../lib/consent';

export function SiteFooter() {
  const t = useTranslations('privacy.footer');
  const locale = useLocale();
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-neutral-500">
        <span>© {new Date().getFullYear()} VOLTSTAR</span>
        <Link href={`/${locale}/privacy`} className="hover:text-black hover:underline">
          {t('privacy')}
        </Link>
        <button onClick={openConsentSettings} className="hover:text-black hover:underline">
          {t('cookies')}
        </button>
        <Link href={`/${locale}/business`} className="hover:text-black hover:underline">
          {t('business')}
        </Link>
      </div>
    </footer>
  );
}

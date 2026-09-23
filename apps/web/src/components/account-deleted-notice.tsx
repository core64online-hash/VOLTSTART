'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/** Повідомлення після видалення акаунта (?accountDeleted=1) — на клієнті, щоб головна лишалась статичною. */
export function AccountDeletedNotice() {
  const t = useTranslations('privacy');
  if (useSearchParams().get('accountDeleted') !== '1') return null;
  return (
    <p role="status" className="bg-green-50 px-4 py-3 text-center text-sm text-green-800">
      {t('accountDeleted')}
    </p>
  );
}

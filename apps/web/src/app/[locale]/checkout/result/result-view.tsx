'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { CheckoutResult } from '@voltstar/types';
import { lastOrder } from '../../../../lib/cart';

export function ResultView() {
  const t = useTranslations('cart.result');
  const locale = useLocale();
  // sessionStorage доступний лише в браузері — читаємо після монтування.
  const [order, setOrder] = useState<CheckoutResult | null | undefined>(undefined);

  useEffect(() => setOrder(lastOrder()), []);

  if (order === undefined) return null;

  return (
    <div className="space-y-4">
      {order ? (
        <p className="text-lg">{t('thanks', { number: order.orderNumber })}</p>
      ) : (
        <p className="text-lg">{t('thanksGeneric')}</p>
      )}
      <p className="text-sm text-neutral-600">{t('note')}</p>
      <Link href={`/${locale}/catalog`} className="inline-block font-medium text-brand-dark hover:underline">
        {t('continue')}
      </Link>
    </div>
  );
}

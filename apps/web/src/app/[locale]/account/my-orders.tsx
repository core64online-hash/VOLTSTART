'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { OrderSummary } from '@voltstar/types';
import { formatPrice } from '../../../lib/api';
import { fetchMyOrders } from '../../../lib/orders';

/** Історія замовлень у кабінеті. */
export function MyOrders() {
  const t = useTranslations('orders');
  const locale = useLocale();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section className="rounded-xl border border-neutral-200 p-5">
      <h2 className="mb-3 text-lg font-semibold">{t('mine')}</h2>
      {failed && <p className="text-sm text-red-600">{t('error')}</p>}
      {!failed && orders === null && <p className="text-sm text-neutral-500">{t('loading')}</p>}
      {orders?.length === 0 && (
        <p className="text-sm text-neutral-600">
          {t('empty')}{' '}
          <Link href={`/${locale}/catalog`} className="font-medium text-brand-dark hover:underline">
            {t('toCatalog')}
          </Link>
        </p>
      )}
      {orders && orders.length > 0 && (
        <ul className="divide-y divide-neutral-100 text-sm">
          {orders.map((o) => (
            <li key={o.number}>
              <Link
                href={`/${locale}/orders/${encodeURIComponent(o.number)}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-neutral-50"
              >
                <span className="font-medium">{o.number}</span>
                <span className="text-neutral-500">{new Date(o.createdAt).toLocaleDateString(`${locale}-UA`)}</span>
                <span>{t(`statuses.${o.status}`)}</span>
                <span className="font-semibold">{formatPrice(o.totalMinor, o.currency, `${locale}-UA`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

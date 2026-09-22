'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { OrderDetail, OrderDocumentKind } from '@voltstar/types';
import { formatPrice } from '../../../../lib/api';
import { ApiError } from '../../../../lib/http';
import { downloadDocument, fetchOrder } from '../../../../lib/orders';

export function OrderView({ number, email }: { number: string; email?: string }) {
  const t = useTranslations('orders');
  const locale = useLocale();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<OrderDocumentKind | null>(null);

  useEffect(() => {
    fetchOrder(number, email)
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? t('notFound') : t('error')));
  }, [number, email, t]);

  if (error) {
    return (
      <p className="text-neutral-600">
        {error}{' '}
        <Link href={`/${locale}/orders/track`} className="font-medium text-brand-dark hover:underline">
          {t('track.title')}
        </Link>
      </p>
    );
  }
  if (!order) return <p className="text-neutral-500">{t('loading')}</p>;

  const money = (minor: number) => formatPrice(minor, order.currency, `${locale}-UA`);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  async function download(kind: OrderDocumentKind) {
    setDownloading(kind);
    try {
      await downloadDocument(number, kind, email);
    } catch {
      setError(t('error'));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-medium text-white">
          {t(`statuses.${order.status}`)}
        </span>
        <span className="text-sm text-neutral-500">{date(order.createdAt)}</span>
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 text-left text-neutral-500">
          <tr>
            <th className="py-2 font-medium">{t('item')}</th>
            <th className="py-2 text-right font-medium">{t('qty')}</th>
            <th className="py-2 text-right font-medium">{t('sum')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {order.items.map((i) => (
            <tr key={i.productId}>
              <td className="py-2">
                <Link href={`/${locale}/catalog/${i.slug}`} className="hover:underline">
                  {i.name}
                </Link>
              </td>
              <td className="py-2 text-right">{i.quantity}</td>
              <td className="py-2 text-right">{money(i.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr>
            <td colSpan={2} className="pt-3 text-right text-neutral-500">{t('delivery')}</td>
            <td className="pt-3 text-right">{order.deliveryMinor ? money(order.deliveryMinor) : t('free')}</td>
          </tr>
          <tr>
            <td colSpan={2} className="text-right text-neutral-500">{t('vat')}</td>
            <td className="text-right">{money(order.vatMinor)}</td>
          </tr>
          <tr className="text-base font-bold">
            <td colSpan={2} className="pt-1 text-right">{t('total')}</td>
            <td className="pt-1 text-right">{money(order.totalMinor)}</td>
          </tr>
        </tfoot>
      </table>

      {order.documents.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('documents')}</h2>
          <div className="flex flex-wrap gap-3">
            {order.documents.map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={downloading !== null}
                onClick={() => void download(kind)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                {downloading === kind ? t('downloading') : `⬇ ${t(`docs.${kind}`)} (PDF)`}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('history')}</h2>
        <ol className="space-y-3 border-l-2 border-neutral-200 pl-4">
          {order.events.map((e, idx) => (
            <li key={idx} className="text-sm">
              <p className="font-medium">{t(`statuses.${e.to}`)}</p>
              <p className="text-neutral-500">{date(e.createdAt)}</p>
              {e.note && <p className="text-neutral-700">{e.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

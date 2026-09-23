'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  MANUAL_ORDER_TRANSITIONS,
  OrderStatus,
  type OrderDetail,
  type OrderDocumentKind,
  type OrderStatus as OrderStatusT,
} from '@voltstar/types';
import { formatPrice } from '../../../../lib/api';
import {
  changeOrderStatus,
  fetchStaffOrder,
  fetchStaffOrders,
  markOrderPaid,
} from '../../../../lib/admin';
import { downloadDocument } from '../../../../lib/orders';
import { errorText, useLoad } from '../../../../lib/use-load';
import { Card, inputCls, Pager, primaryBtn, secondaryBtn } from '../ui';

/** Замовлення для персоналу: пошук, фільтр, картка з переходами статусу й звіркою оплати. */
export function OrdersAdmin() {
  const t = useTranslations('admin.orders');
  const tStatus = useTranslations('orders.statuses');
  const locale = useLocale();
  const [status, setStatus] = useState<OrderStatusT | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const { data, error } = useLoad(
    () => fetchStaffOrders({ status: status || undefined, q: query || undefined, page }),
    [status, query, page, version],
  );
  const date = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-3">
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <input
            className={`${inputCls} min-w-[16rem] flex-1`}
            placeholder={t('search')}
            aria-label={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label={t('status')}
            className={inputCls}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as OrderStatusT | '');
            }}
          >
            <option value="">{t('allStatuses')}</option>
            {Object.values(OrderStatus).map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </select>
          <button type="submit" className={secondaryBtn}>
            {t('find')}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && data.items.length === 0 && <p className="text-neutral-500">{t('empty')}</p>}
        {data && data.items.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2">№</th>
                  <th className="px-3 py-2">{t('date')}</th>
                  <th className="px-3 py-2">{t('customer')}</th>
                  <th className="px-3 py-2">{t('status')}</th>
                  <th className="px-3 py-2 text-right">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr
                    key={o.number}
                    data-order={o.number}
                    onClick={() => setSelected(o.number)}
                    className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 ${
                      selected === o.number ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{o.number}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                      {date(o.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <p>{o.organization ?? o.contactName ?? '—'}</p>
                      <p className="break-all text-xs text-neutral-500">
                        {o.contactEmail} · {o.segment}
                      </p>
                    </td>
                    <td className="px-3 py-2">{tStatus(o.status)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {formatPrice(o.totalMinor, o.currency, `${locale}-UA`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pager page={data.page} perPage={data.perPage} total={data.total} onPage={setPage} />
        )}
      </section>
      {selected && (
        <OrderPanel
          number={selected}
          version={version}
          onClose={() => setSelected(null)}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}

function OrderPanel({
  number,
  version,
  onClose,
  onChanged,
}: {
  number: string;
  version: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations('admin.orders');
  const tStatus = useTranslations('orders.statuses');
  const tOrders = useTranslations('orders');
  const locale = useLocale();
  const {
    data: order,
    error,
    setError,
    setData,
  } = useLoad(() => fetchStaffOrder(number), [number, version]);
  const [to, setTo] = useState<OrderStatusT | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!order)
    return (
      <aside className="rounded-xl border border-neutral-200 p-4">{error ?? t('loading')}</aside>
    );
  const money = (minor: number) => formatPrice(minor, order.currency, `${locale}-UA`);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  const next = MANUAL_ORDER_TRANSITIONS[order.status];
  const awaitingInvoice = order.status === 'INVOICED';

  async function run(fn: () => Promise<OrderDetail | unknown>) {
    setBusy(true);
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'items' in res) setData(res as OrderDetail);
      setTo('');
      setNote('');
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      aria-label={t('panel', { number })}
      className="space-y-5 rounded-xl border border-neutral-200 p-4 text-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{order.number}</h2>
          <p className="text-neutral-500">
            {tStatus(order.status)} · {order.segment} · {date(order.createdAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="text-neutral-500 hover:text-black"
        >
          ✕
        </button>
      </header>
      {error && <p className="text-red-600">{error}</p>}

      <div>
        <p className="font-medium">{order.organization?.name ?? order.contact.name}</p>
        {order.organization?.edrpou && (
          <p className="text-neutral-500">ЄДРПОУ {order.organization.edrpou}</p>
        )}
        <p className="break-all text-neutral-500">
          {[order.contact.name, order.contact.phone, order.contact.email]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <table className="w-full">
        <tbody>
          {order.items.map((i) => (
            <tr key={i.productId} className="border-b border-neutral-100">
              <td className="py-1">
                {i.name} <span className="text-neutral-500">× {i.quantity}</span>
              </td>
              <td className="py-1 text-right">{money(i.totalMinor)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 text-neutral-500">{tOrders(`delivery`)}</td>
            <td className="py-1 text-right">{money(order.deliveryMinor)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-1">{tOrders('total')}</td>
            <td className="py-1 text-right">{money(order.totalMinor)}</td>
          </tr>
        </tbody>
      </table>

      {awaitingInvoice && (
        <button
          disabled={busy}
          className={primaryBtn}
          onClick={() => run(() => markOrderPaid(order.number))}
        >
          {t('markPaid')}
        </button>
      )}

      {next.length > 0 && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (to) void run(() => changeOrderStatus(order.number, to, note.trim() || undefined));
          }}
        >
          <label className="block">
            {t('moveTo')}
            <select
              className={`${inputCls} mt-1 w-full`}
              value={to}
              onChange={(e) => setTo(e.target.value as OrderStatusT | '')}
            >
              <option value="">—</option>
              {next.map((s) => (
                <option key={s} value={s}>
                  {tStatus(s)}
                </option>
              ))}
            </select>
          </label>
          <input
            className={`${inputCls} w-full`}
            placeholder={t('note')}
            aria-label={t('note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="submit" disabled={!to || busy} className={secondaryBtn}>
            {t('apply')}
          </button>
        </form>
      )}

      {order.documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {order.documents.map((kind: OrderDocumentKind) => (
            <button
              key={kind}
              className={secondaryBtn}
              onClick={() =>
                downloadDocument(order.number, kind).catch((e) => setError(errorText(e)))
              }
            >
              {tOrders(`docs.${kind}`)}
            </button>
          ))}
        </div>
      )}

      <Card title={t('history')} className="p-3">
        <ol className="space-y-1.5">
          {order.events.map((e, i) => (
            <li key={i}>
              <span className="text-xs text-neutral-500">{date(e.createdAt)}</span> ·{' '}
              {tStatus(e.to)}
              {e.note && <span className="block text-neutral-600">{e.note}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </aside>
  );
}

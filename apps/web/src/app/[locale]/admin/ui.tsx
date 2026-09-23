'use client';

import { useTranslations } from 'next-intl';

/** Перемикач сторінок списку. */
export function Pager({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const t = useTranslations('admin');
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const btn = 'rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40';
  return (
    <div className="flex items-center gap-3 text-sm">
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ←
      </button>
      <span>{t('pager', { page, pages, total })}</span>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        →
      </button>
    </div>
  );
}

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-neutral-200 p-5 ${className}`}>
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export const inputCls = 'rounded border border-neutral-300 px-2 py-1';
export const primaryBtn =
  'rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-50';
export const secondaryBtn =
  'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50';

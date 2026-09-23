'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CreateLeadSchema, LeadSource } from '@voltstar/types';
import { submitLead } from '../lib/crm';

type Props = {
  source: LeadSource;
  /** Для запиту бізнесу — поля компанії та вибір B2B/B2G. */
  business?: boolean;
  /** Контекст заявки (наприклад, розрахунок підбору) — бачить менеджер. */
  payload?: Record<string, unknown>;
  defaultMessage?: string;
};

type Field = 'name' | 'phone' | 'email' | 'companyName' | 'edrpou' | 'message';

/** Заявка в CRM. Валідація та сама, що на сервері (спільна zod-схема). */
export function LeadForm({ source, business = false, payload, defaultMessage = '' }: Props) {
  const t = useTranslations('lead');
  const locale = useLocale();
  const [values, setValues] = useState<Record<Field, string>>({
    name: '',
    phone: '',
    email: '',
    companyName: '',
    edrpou: '',
    message: defaultMessage,
  });
  const [kind, setKind] = useState<LeadSource>(business ? LeadSource.B2B_REQUEST : source);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [f]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CreateLeadSchema.safeParse({
      source: kind,
      ...values,
      companyName: values.companyName || undefined,
      message: values.message || undefined,
      payload,
      website,
    });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const f = issue.path[0] as Field;
        next[f] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStatus('sending');
    try {
      await submitLead(parsed.data);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div
        role="status"
        className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
      >
        <p className="font-semibold">{t('sentTitle')}</p>
        <p className="mt-1 text-sm">{t('sentText')}</p>
      </div>
    );
  }

  const input = 'mt-1 w-full rounded border px-3 py-2';
  const err = (f: Field) =>
    errors[f] && <span className="mt-1 block text-xs text-red-600">{errors[f]}</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {business && (
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-1 text-neutral-500">{t('segment')}</legend>
          {[LeadSource.B2B_REQUEST, LeadSource.B2G_REQUEST].map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input type="radio" name="segment" checked={kind === s} onChange={() => setKind(s)} />
              {t(`segments.${s}`)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          {t('name')}
          <input className={input} value={values.name} onChange={set('name')} autoComplete="name" />
          {err('name')}
        </label>
        <label className="text-sm">
          {t('phone')}
          <input
            className={input}
            type="tel"
            value={values.phone}
            onChange={set('phone')}
            autoComplete="tel"
          />
          {err('phone')}
        </label>
        <label className="text-sm">
          {t('email')}
          <input
            className={input}
            type="email"
            value={values.email}
            onChange={set('email')}
            autoComplete="email"
          />
          {err('email')}
        </label>
        {business && (
          <>
            <label className="text-sm">
              {t('companyName')}
              <input
                className={input}
                value={values.companyName}
                onChange={set('companyName')}
                autoComplete="organization"
              />
              {err('companyName')}
            </label>
            <label className="text-sm">
              {t('edrpou')}
              <input
                className={input}
                inputMode="numeric"
                value={values.edrpou}
                onChange={set('edrpou')}
              />
              {err('edrpou')}
            </label>
          </>
        )}
        <label className="text-sm sm:col-span-2">
          {t('message')}
          <textarea className={input} rows={4} value={values.message} onChange={set('message')} />
          {err('message')}
        </label>
      </div>
      {/* Пастка для ботів: поза екраном, людина її не заповнює. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <p className="text-xs text-neutral-500">
        {t('consent')}{' '}
        <Link href={`/${locale}/privacy`} className="underline">
          {t('privacyLink')}
        </Link>
      </p>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="rounded-lg bg-brand px-6 py-3 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
      >
        {status === 'sending' ? t('sending') : t('submit')}
      </button>
      {status === 'error' && <p className="text-sm text-red-600">{t('error')}</p>}
    </form>
  );
}

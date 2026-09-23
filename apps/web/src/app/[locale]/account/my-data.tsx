'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { clearToken } from '../../../lib/auth';
import { deleteMyAccount, downloadMyData } from '../../../lib/privacy';

/** Права щодо персональних даних: вивантаження й видалення акаунта. */
export function MyData() {
  const t = useTranslations('privacy.account');
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);

  async function exportData() {
    setBusy('export');
    setError(null);
    try {
      await downloadMyData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy('delete');
    setError(null);
    try {
      await deleteMyAccount(password);
      clearToken();
      router.push(`/${locale}?accountDeleted=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 p-5" aria-labelledby="my-data-title">
      <h2 id="my-data-title" className="text-lg font-semibold">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        {t('text')}{' '}
        <Link href={`/${locale}/privacy#rights`} className="text-brand-dark underline">
          {t('policy')}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={exportData}
          disabled={busy !== null}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy === 'export' ? t('exporting') : t('export')}
        </button>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {t('delete')}
          </button>
        )}
      </div>
      {confirming && (
        <form onSubmit={remove} className="mt-4 space-y-3 rounded-lg bg-red-50 p-4 text-sm">
          <p className="text-red-800">{t('deleteWarning')}</p>
          <label className="block">
            {t('password')}
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            {t('understood')}
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!password || !understood || busy !== null}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy === 'delete' ? t('deleting') : t('confirmDelete')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border px-4 py-2"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { resetPassword } from '../../../lib/auth';

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <p className="text-sm text-red-600">
        {t('reset.noToken')}{' '}
        <Link href={`/${locale}/forgot-password`} className="font-medium hover:underline">
          {t('forgot.submit')}
        </Link>
      </p>
    );
  }

  if (state === 'done') {
    return (
      <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
        {t('reset.done')}{' '}
        <Link href={`/${locale}/login`} className="font-medium underline">
          {t('login.submit')}
        </Link>
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('reset.mismatch'));
      return;
    }
    setState('saving');
    setError(null);
    try {
      await resetPassword(token, password);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
      setState('idle');
    }
  }

  const field = 'mt-1 w-full rounded border border-neutral-300 px-3 py-2';
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        {t('reset.password')}
        <input type="password" required minLength={8} autoComplete="new-password" className={field}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="block text-sm">
        {t('reset.confirm')}
        <input type="password" required minLength={8} autoComplete="new-password" className={field}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={state === 'saving'}
        className="w-full rounded-lg bg-brand px-6 py-3 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
      >
        {state === 'saving' ? t('reset.saving') : t('reset.submit')}
      </button>
    </form>
  );
}

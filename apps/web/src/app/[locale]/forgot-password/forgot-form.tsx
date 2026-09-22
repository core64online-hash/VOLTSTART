'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { requestPasswordReset } from '../../../lib/auth';

export function ForgotForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await requestPasswordReset(email, locale);
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
      setState('idle');
    }
  }

  // Однакова відповідь для будь-якого email — не розкриваємо, хто зареєстрований.
  if (state === 'sent') return <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{t('forgot.sent')}</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        {t('email')}
        <input
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-lg bg-brand px-6 py-3 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
      >
        {state === 'sending' ? t('forgot.sending') : t('forgot.submit')}
      </button>
    </form>
  );
}

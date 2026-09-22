'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { addToCart } from '../../../../lib/cart';

export function AddToCartButton({ productId, disabled }: { productId: string; disabled?: boolean }) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setState('adding');
    setError(null);
    try {
      await addToCart(productId, 1);
      setState('added');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setState('idle');
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || state === 'adding'}
        className="rounded-lg bg-brand px-6 py-3 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
      >
        {state === 'adding' ? t('adding') : t('add')}
      </button>
      {state === 'added' && (
        <Link href={`/${locale}/cart`} className="text-sm font-medium text-brand-dark hover:underline">
          {t('added')} → {t('goToCart')}
        </Link>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

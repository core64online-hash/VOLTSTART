'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { AuthUser } from '@voltstar/types';
import { clearToken, fetchMe, getToken } from '../../../lib/auth';
import { MyOrders } from './my-orders';

type State =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'ready'; user: AuthUser };

export function AccountView() {
  const t = useTranslations('account');
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState({ status: 'anon' });
      return;
    }
    fetchMe(token)
      .then((user) => setState({ status: 'ready', user }))
      .catch(() => {
        clearToken();
        setState({ status: 'anon' });
      });
  }, []);

  function logout() {
    clearToken();
    router.push(`/${locale}/login`);
  }

  if (state.status === 'loading') {
    return <p className="text-neutral-500">{t('profile.loading')}</p>;
  }

  if (state.status === 'anon') {
    return (
      <p className="text-neutral-600">
        {t('profile.pleaseLogin')}{' '}
        <Link href={`/${locale}/login`} className="font-medium text-brand-dark hover:underline">
          {t('profile.loginLink')}
        </Link>
      </p>
    );
  }

  const { user } = state;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const row = 'flex justify-between border-b border-neutral-100 py-2';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-lg font-semibold">{name}</p>
        <dl className="mt-3 text-sm">
          <div className={row}>
            <dt className="text-neutral-500">{t('email')}</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          {user.phone && (
            <div className={row}>
              <dt className="text-neutral-500">{t('phone')}</dt>
              <dd className="font-medium">{user.phone}</dd>
            </div>
          )}
          <div className={row}>
            <dt className="text-neutral-500">{t('profile.role')}</dt>
            <dd className="font-medium">{user.role}</dd>
          </div>
          <div className={row}>
            <dt className="text-neutral-500">{t('profile.segment')}</dt>
            <dd className="font-medium">{user.segment}</dd>
          </div>
        </dl>
      </div>

      {user.organization && (
        <div className="rounded-xl border border-neutral-200 p-5">
          <h2 className="mb-3 text-lg font-semibold">{t('profile.organization')}</h2>
          <dl className="text-sm">
            <div className={row}>
              <dt className="text-neutral-500">{t('orgName')}</dt>
              <dd className="font-medium">{user.organization.name}</dd>
            </div>
            {user.organization.edrpou && (
              <div className={row}>
                <dt className="text-neutral-500">{t('edrpou')}</dt>
                <dd className="font-medium">{user.organization.edrpou}</dd>
              </div>
            )}
            <div className={row}>
              <dt className="text-neutral-500">{t('profile.verified')}</dt>
              <dd className={user.organization.verified ? 'font-medium text-green-600' : 'font-medium text-amber-600'}>
                {user.organization.verified ? t('profile.verifiedYes') : t('profile.verifiedNo')}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <MyOrders />

      <button
        type="button"
        onClick={logout}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        {t('profile.logout')}
      </button>
    </div>
  );
}

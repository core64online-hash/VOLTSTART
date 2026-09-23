'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Role } from '@voltstar/types';
import { clearToken, fetchMe, getToken } from '../../../lib/auth';

type StaffRole = typeof Role.MANAGER | typeof Role.ADMIN;
const RoleContext = createContext<StaffRole>(Role.MANAGER);

/** Роль поточного співробітника: MANAGER або ADMIN. */
export const useStaffRole = () => useContext(RoleContext);

const NAV: { href: string; key: string; adminOnly?: boolean }[] = [
  { href: '', key: 'dashboard' },
  { href: '/orders', key: 'orders' },
  { href: '/catalog', key: 'catalog' },
  { href: '/clients', key: 'clients' },
  { href: '/audit', key: 'audit', adminOnly: true },
];

/** Каркас back-office: перевірка ролі, навігація розділами. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'anon' | 'forbidden' | StaffRole>('loading');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState('anon');
      return;
    }
    fetchMe(token)
      .then((u) =>
        setState(u.role === Role.MANAGER || u.role === Role.ADMIN ? u.role : 'forbidden'),
      )
      .catch(() => {
        clearToken();
        setState('anon');
      });
  }, []);

  if (state === 'loading') return <p className="text-neutral-500">{t('loading')}</p>;
  if (state === 'anon') {
    return (
      <p className="text-neutral-600">
        {t('pleaseLogin')}{' '}
        <Link href={`/${locale}/login`} className="font-medium text-brand-dark hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    );
  }
  if (state === 'forbidden') return <p className="text-red-600">{t('noAccess')}</p>;

  const base = `/${locale}/admin`;
  return (
    <RoleContext.Provider value={state}>
      <nav
        aria-label={t('title')}
        className="mb-8 flex flex-wrap items-center gap-1 border-b border-neutral-200"
      >
        {NAV.filter((n) => !n.adminOnly || state === Role.ADMIN).map((n) => {
          const href = base + n.href;
          const active = n.href === '' ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={n.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                active
                  ? 'border-brand text-black'
                  : 'border-transparent text-neutral-500 hover:text-black'
              }`}
            >
              {t(`nav.${n.key}`)}
            </Link>
          );
        })}
        <Link
          href={`/${locale}/manager/crm`}
          className="ml-auto px-4 py-2 text-sm text-neutral-500 hover:text-black"
        >
          CRM →
        </Link>
      </nav>
      {children}
    </RoleContext.Provider>
  );
}

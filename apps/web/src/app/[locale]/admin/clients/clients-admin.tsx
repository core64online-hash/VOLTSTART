'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Role, type AdminUser, type Role as RoleT } from '@voltstar/types';
import {
  fetchAdminUsers,
  fetchOrganizations,
  setUserRole,
  verifyOrganization,
} from '../../../../lib/admin';
import { errorText, useLoad } from '../../../../lib/use-load';
import { useStaffRole } from '../admin-shell';
import { Card, inputCls, Pager, secondaryBtn } from '../ui';

const ASSIGNABLE: Exclude<RoleT, 'GUEST'>[] = [Role.CUSTOMER, Role.MANAGER, Role.ADMIN];

/** Клієнти: черга верифікації організацій (менеджер і адмін) та користувачі з ролями (адмін). */
export function ClientsAdmin() {
  const isAdmin = useStaffRole() === Role.ADMIN;
  return (
    <div className="space-y-8">
      <OrganizationsQueue />
      {isAdmin && <UsersTable />}
    </div>
  );
}

function OrganizationsQueue() {
  const t = useTranslations('admin.clients');
  const locale = useLocale();
  const [showVerified, setShowVerified] = useState(false);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const { data, error, setError } = useLoad(
    () => fetchOrganizations({ verified: showVerified ? undefined : false, page }),
    [showVerified, page, version],
  );
  return (
    <Card title={t('orgsTitle')}>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showVerified}
          onChange={(e) => setShowVerified(e.target.checked)}
        />
        {t('showVerified')}
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-neutral-500">{t('orgsEmpty')}</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-neutral-100 text-sm">
          {data.items.map((o) => (
            <li
              key={o.id}
              data-org={o.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2"
            >
              <div>
                <p className="font-medium">{o.name}</p>
                <p className="text-neutral-500">
                  {o.segment} · {t('edrpou')} {o.edrpou ?? '—'} ·{' '}
                  {new Date(o.createdAt).toLocaleDateString(`${locale}-UA`)}
                </p>
                <p className="break-all text-xs text-neutral-500">
                  {o.users.map((u) => u.email).join(', ')}
                </p>
              </div>
              {o.verified ? (
                <span className="text-green-700">{t('verified')}</span>
              ) : (
                <button
                  className={secondaryBtn}
                  onClick={async () => {
                    try {
                      await verifyOrganization(o.id);
                      setVersion((v) => v + 1);
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                >
                  {t('verify')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && (
        <Pager page={data.page} perPage={data.perPage} total={data.total} onPage={setPage} />
      )}
    </Card>
  );
}

function UsersTable() {
  const t = useTranslations('admin.clients');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleT | ''>('');
  const [page, setPage] = useState(1);
  const { data, error, setError, setData } = useLoad(
    () => fetchAdminUsers({ q: query || undefined, role: role || undefined, page }),
    [query, role, page],
  );

  const change = async (u: AdminUser, next: Exclude<RoleT, 'GUEST'>) => {
    try {
      const saved = await setUserRole(u.id, next);
      setError(null);
      if (data) setData({ ...data, items: data.items.map((x) => (x.id === saved.id ? saved : x)) });
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Card title={t('usersTitle')}>
      <form
        className="mb-3 flex flex-wrap gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          className={`${inputCls} min-w-[14rem] flex-1`}
          placeholder={t('search')}
          aria-label={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={t('roleFilter')}
          className={inputCls}
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value as RoleT | '');
          }}
        >
          <option value="">{t('allRoles')}</option>
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
        <button type="submit" className={secondaryBtn}>
          {t('find')}
        </button>
      </form>
      <p className="mb-2 text-xs text-neutral-500">{t('roleHint')}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-neutral-500">{t('usersEmpty')}</p>
      )}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2">{t('user')}</th>
                <th className="py-2">{t('organization')}</th>
                <th className="py-2 text-right">{t('orders')}</th>
                <th className="py-2">{t('role')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} data-user={u.email} className="border-t border-neutral-100">
                  <td className="py-2">
                    <p className="break-all font-medium">{u.email}</p>
                    <p className="text-neutral-500">
                      {[u.name, u.phone].filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="py-2">
                    {u.organization ? (
                      <>
                        {u.organization.name}
                        {!u.organization.verified && (
                          <span className="ml-1 text-xs text-amber-600">({t('notVerified')})</span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 text-right">{u.ordersCount}</td>
                  <td className="py-2">
                    <select
                      aria-label={t('roleOf', { email: u.email })}
                      className={inputCls}
                      value={u.role}
                      onChange={(e) => change(u, e.target.value as Exclude<RoleT, 'GUEST'>)}
                    >
                      {ASSIGNABLE.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
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
    </Card>
  );
}

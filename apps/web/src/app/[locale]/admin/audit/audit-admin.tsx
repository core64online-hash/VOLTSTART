'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Role } from '@voltstar/types';
import { fetchAudit } from '../../../../lib/admin';
import { useLoad } from '../../../../lib/use-load';
import { useStaffRole } from '../admin-shell';
import { inputCls, Pager } from '../ui';

/** next-intl трактує крапку як вкладеність ключів, тож у повідомленнях — підкреслення. */
const actionKey = (action: string) => action.replace(/\./g, '_');

const ENTITIES = ['Order', 'Product', 'User', 'Organization', 'Lead', 'Deal', 'Search'] as const;

/** Журнал дій персоналу (лише адміністратор). */
export function AuditAdmin() {
  const t = useTranslations('admin.audit');
  const locale = useLocale();
  const isAdmin = useStaffRole() === Role.ADMIN;
  const [entity, setEntity] = useState('');
  const [entityId, setEntityId] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(
    () =>
      isAdmin
        ? fetchAudit({ entity: entity || undefined, entityId: entityId.trim() || undefined, page })
        : Promise.resolve(null),
    [entity, entityId, page, isAdmin],
  );
  if (!isAdmin) return <p className="text-red-600">{t('adminOnly')}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <select
          aria-label={t('entity')}
          className={inputCls}
          value={entity}
          onChange={(e) => {
            setPage(1);
            setEntity(e.target.value);
          }}
        >
          <option value="">{t('allEntities')}</option>
          {ENTITIES.map((x) => (
            <option key={x} value={x}>
              {t(`entities.${x}`)}
            </option>
          ))}
        </select>
        <input
          className={`${inputCls} min-w-[16rem]`}
          placeholder={t('entityId')}
          aria-label={t('entityId')}
          value={entityId}
          onChange={(e) => {
            setPage(1);
            setEntityId(e.target.value);
          }}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.items.length === 0 && <p className="text-neutral-500">{t('empty')}</p>}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2">{t('when')}</th>
                <th className="px-3 py-2">{t('who')}</th>
                <th className="px-3 py-2">{t('action')}</th>
                <th className="px-3 py-2">{t('object')}</th>
                <th className="px-3 py-2">{t('details')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr
                  key={a.id}
                  data-audit={a.action}
                  className="border-t border-neutral-100 align-top"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                    {new Date(a.createdAt).toLocaleString(`${locale}-UA`, {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="break-all px-3 py-2">{a.actor?.email ?? t('system')}</td>
                  <td className="px-3 py-2">
                    <p>
                      {t.has(`actions.${actionKey(a.action)}`)
                        ? t(`actions.${actionKey(a.action)}`)
                        : a.action}
                    </p>
                    <p className="font-mono text-xs text-neutral-400">{a.action}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{t.has(`entities.${a.entity}`) ? t(`entities.${a.entity}`) : a.entity}</p>
                    {a.entityId && (
                      <button
                        className="break-all font-mono text-xs text-brand-dark hover:underline"
                        onClick={() => {
                          setEntity(a.entity);
                          setEntityId(a.entityId!);
                          setPage(1);
                        }}
                      >
                        {a.entityId}
                      </button>
                    )}
                  </td>
                  <td className="max-w-md px-3 py-2">
                    {a.data != null && (
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-neutral-50 p-2 text-xs">
                        {JSON.stringify(a.data, null, 1)}
                      </pre>
                    )}
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
    </div>
  );
}

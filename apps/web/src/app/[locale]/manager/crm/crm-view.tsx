'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  DealStage,
  LeadStatus,
  Role,
  type ActivityType,
  type CrmTask,
  type DealDetail,
  type DealStage as DealStageT,
  type Lead,
  type LeadStatus as LeadStatusT,
  type Pipeline,
} from '@voltstar/types';
import { formatPrice } from '../../../../lib/api';
import { clearToken, fetchMe, getToken } from '../../../../lib/auth';
import {
  addActivity,
  changeDealStage,
  convertLead,
  createTask,
  fetchDeal,
  fetchLeads,
  fetchPipeline,
  fetchTasks,
  setTaskDone,
  updateLeadStatus,
} from '../../../../lib/crm';

type Tab = 'leads' | 'pipeline' | 'tasks';
type Access = 'loading' | 'anon' | 'forbidden' | 'ok';

const OPEN_STAGES: DealStageT[] = [
  DealStage.NEW,
  DealStage.QUALIFIED,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
];
const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'note'];
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function useDateFormat() {
  const locale = useLocale();
  return (iso: string, withTime = true) =>
    new Intl.DateTimeFormat(
      locale,
      withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' },
    ).format(new Date(iso));
}

/** Робоче місце менеджера: ліди → угоди (канбан) → задачі. */
export function CrmView() {
  const t = useTranslations('crm');
  const locale = useLocale();
  const [access, setAccess] = useState<Access>('loading');
  const [tab, setTab] = useState<Tab>('leads');
  const [mine, setMine] = useState(false);
  const [dealId, setDealId] = useState<string | null>(null);
  // Лічильник змін: після дії в одній вкладці інші перечитують дані.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAccess('anon');
      return;
    }
    fetchMe(token)
      .then((u) => setAccess(u.role === Role.MANAGER || u.role === Role.ADMIN ? 'ok' : 'forbidden'))
      .catch(() => {
        clearToken();
        setAccess('anon');
      });
  }, []);

  if (access === 'loading') return <p className="text-neutral-500">{t('loading')}</p>;
  if (access === 'anon') {
    return (
      <p className="text-neutral-600">
        {t('pleaseLogin')}{' '}
        <Link href={`/${locale}/login`} className="font-medium text-brand-dark hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    );
  }
  if (access === 'forbidden') return <p className="text-red-600">{t('noAccess')}</p>;

  const openDeal = (id: string) => {
    setDealId(id);
    setTab('pipeline');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {(['leads', 'pipeline', 'tasks'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === k ? 'bg-white shadow-sm' : 'text-neutral-600'}`}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          {t('mine')}
        </label>
      </div>

      {tab === 'leads' && (
        <LeadsTab mine={mine} version={version} onChanged={refresh} onOpenDeal={openDeal} />
      )}
      {tab === 'pipeline' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <PipelineBoard
            mine={mine}
            version={version}
            selected={dealId}
            onSelect={setDealId}
            onChanged={refresh}
          />
          {dealId && (
            <DealPanel
              id={dealId}
              version={version}
              onClose={() => setDealId(null)}
              onChanged={refresh}
            />
          )}
        </div>
      )}
      {tab === 'tasks' && (
        <TasksTab mine={mine} version={version} onChanged={refresh} onOpenDeal={openDeal} />
      )}
    </div>
  );
}

/** Завантаження з повтором при зміні залежностей; помилка показується над вмістом. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, deps);
  return { data, error, setError };
}

function LeadsTab({
  mine,
  version,
  onChanged,
  onOpenDeal,
}: {
  mine: boolean;
  version: number;
  onChanged: () => void;
  onOpenDeal: (id: string) => void;
}) {
  const t = useTranslations('crm');
  const fmtDate = useDateFormat();
  const [status, setStatus] = useState<LeadStatusT | ''>('');
  const {
    data: leads,
    error,
    setError,
  } = useLoad(() => fetchLeads({ status: status || undefined, mine }), [status, mine, version]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <section className="space-y-3">
      <label className="text-sm">
        {t('leads.filter')}{' '}
        <select
          className="rounded border px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatusT | '')}
        >
          <option value="">{t('leads.all')}</option>
          {Object.values(LeadStatus).map((s) => (
            <option key={s} value={s}>
              {t(`leadStatuses.${s}`)}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {leads && leads.length === 0 && <p className="text-neutral-500">{t('leads.empty')}</p>}
      {leads && leads.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2">{t('leads.date')}</th>
                <th className="px-3 py-2">{t('leads.who')}</th>
                <th className="px-3 py-2">{t('leads.contact')}</th>
                <th className="px-3 py-2">{t('leads.source')}</th>
                <th className="px-3 py-2">{t('leads.owner')}</th>
                <th className="px-3 py-2">{t('leads.status')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <LeadRow key={l.id} lead={l} fmtDate={fmtDate} act={act} onOpenDeal={onOpenDeal} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LeadRow({
  lead: l,
  fmtDate,
  act,
  onOpenDeal,
}: {
  lead: Lead;
  fmtDate: (iso: string) => string;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  onOpenDeal: (id: string) => void;
}) {
  const t = useTranslations('crm');
  const closed = l.status === LeadStatus.CONVERTED;
  return (
    <tr className="border-t border-neutral-100 align-top" data-lead={l.id}>
      <td className="whitespace-nowrap px-3 py-2 text-neutral-500">{fmtDate(l.createdAt)}</td>
      <td className="px-3 py-2">
        <p className="font-medium">{l.name ?? '—'}</p>
        {l.companyName && (
          <p className="text-neutral-500">
            {l.companyName}
            {l.edrpou && ` · ${l.edrpou}`}
          </p>
        )}
        {l.message && (
          <p className="mt-1 max-w-xs whitespace-pre-line text-neutral-600">{l.message}</p>
        )}
      </td>
      <td className="px-3 py-2">
        {l.phone && <p>+{l.phone}</p>}
        {l.email && <p className="break-all text-neutral-500">{l.email}</p>}
      </td>
      <td className="px-3 py-2">
        <p>{t(`sources.${l.source}`)}</p>
        <p className="text-neutral-500">{l.segment}</p>
      </td>
      <td className="max-w-[12rem] break-all px-3 py-2 text-neutral-600">
        {l.owner?.email ?? t('unassigned')}
      </td>
      <td className="px-3 py-2">
        {closed ? (
          t(`leadStatuses.${l.status}`)
        ) : (
          <select
            aria-label={t('leads.status')}
            className="rounded border px-2 py-1"
            value={l.status}
            onChange={(e) => act(() => updateLeadStatus(l.id, e.target.value as LeadStatusT))}
          >
            {Object.values(LeadStatus)
              .filter((s) => s !== LeadStatus.CONVERTED)
              .map((s) => (
                <option key={s} value={s}>
                  {t(`leadStatuses.${s}`)}
                </option>
              ))}
          </select>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {l.dealId ? (
          <button className="text-brand-dark hover:underline" onClick={() => onOpenDeal(l.dealId!)}>
            {t('leads.openDeal')}
          </button>
        ) : (
          l.status !== LeadStatus.DISQUALIFIED && (
            <button
              className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-50"
              onClick={() => act(async () => onOpenDeal((await convertLead(l.id)).id))}
            >
              {t('leads.convert')}
            </button>
          )
        )}
      </td>
    </tr>
  );
}

function PipelineBoard({
  mine,
  version,
  selected,
  onSelect,
  onChanged,
}: {
  mine: boolean;
  version: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const t = useTranslations('crm');
  const { data, error, setError } = useLoad<Pipeline>(() => fetchPipeline(mine), [mine, version]);

  const advance = async (id: string, stage: DealStageT) => {
    try {
      await changeDealStage(id, { stage });
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <section className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="flex items-start gap-3 overflow-x-auto pb-2">
          {data.stages.map((col) => (
            <div
              key={col.stage}
              data-stage={col.stage}
              className="w-56 shrink-0 rounded-xl bg-neutral-100 p-2"
            >
              <header className="mb-2 px-1">
                <p className="text-sm font-semibold">{t(`stages.${col.stage}`)}</p>
                <p className="text-xs text-neutral-500">
                  {col.count} · {formatPrice(col.totalMinor, 'UAH')}
                </p>
              </header>
              <ul className="space-y-2">
                {col.deals.map((d) => {
                  const i = OPEN_STAGES.indexOf(d.stage);
                  const next = i >= 0 && i < OPEN_STAGES.length - 1 ? OPEN_STAGES[i + 1] : null;
                  return (
                    <li
                      key={d.id}
                      data-deal={d.id}
                      className={`rounded-lg bg-white p-2 text-sm shadow-sm ${selected === d.id ? 'ring-2 ring-brand' : ''}`}
                    >
                      <button className="w-full text-left" onClick={() => onSelect(d.id)}>
                        <p className="font-medium">{d.title}</p>
                        {d.company && <p className="text-xs text-neutral-500">{d.company.name}</p>}
                        <p className="text-xs">{formatPrice(d.amountMinor, d.currency)}</p>
                        {d.orderNumber && (
                          <p className="text-xs text-neutral-500">№ {d.orderNumber}</p>
                        )}
                      </button>
                      {next && (
                        <button
                          className="mt-1 text-xs text-brand-dark hover:underline"
                          onClick={() => advance(d.id, next)}
                        >
                          → {t(`stages.${next}`)}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DealPanel({
  id,
  version,
  onClose,
  onChanged,
}: {
  id: string;
  version: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations('crm');
  const fmtDate = useDateFormat();
  const { data: deal, error, setError } = useLoad<DealDetail>(() => fetchDeal(id), [id, version]);
  const [stage, setStage] = useState<DealStageT | ''>('');
  const [lostReason, setLostReason] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('call');
  const [activityText, setActivityText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');

  useEffect(() => {
    setStage('');
    setLostReason('');
  }, [id, version]);

  const act = async (fn: () => Promise<unknown>, reset?: () => void) => {
    try {
      await fn();
      reset?.();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  };

  if (!deal) {
    return (
      <aside className="rounded-xl border border-neutral-200 p-4">{error ?? t('loading')}</aside>
    );
  }
  const closed = deal.stage === DealStage.WON || deal.stage === DealStage.LOST;
  const row = 'flex justify-between gap-3 border-b border-neutral-100 py-1.5';

  return (
    <aside
      aria-label={t('deal.title')}
      className="space-y-5 rounded-xl border border-neutral-200 p-4 text-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{deal.title}</h2>
          <p className="text-neutral-500">{t(`stages.${deal.stage}`)}</p>
        </div>
        <button
          onClick={onClose}
          aria-label={t('deal.close')}
          className="text-neutral-400 hover:text-black"
        >
          ✕
        </button>
      </header>
      {error && <p className="text-red-600">{error}</p>}

      <dl>
        <div className={row}>
          <dt className="text-neutral-500">{t('deal.amount')}</dt>
          <dd className="font-medium">{formatPrice(deal.amountMinor, deal.currency)}</dd>
        </div>
        {deal.company && (
          <div className={row}>
            <dt className="text-neutral-500">{t('deal.company')}</dt>
            <dd className="text-right">
              {deal.company.name}
              {deal.company.edrpou && ` · ${deal.company.edrpou}`}
            </dd>
          </div>
        )}
        {deal.contact && (
          <div className={row}>
            <dt className="text-neutral-500">{t('deal.contact')}</dt>
            <dd className="text-right">
              {deal.contact.name}
              {deal.contact.phone && <span className="block">+{deal.contact.phone}</span>}
              {deal.contact.email && (
                <span className="block text-neutral-500">{deal.contact.email}</span>
              )}
            </dd>
          </div>
        )}
        <div className={row}>
          <dt className="text-neutral-500">{t('deal.owner')}</dt>
          <dd className="break-all text-right">{deal.owner?.email ?? t('unassigned')}</dd>
        </div>
        {deal.orderNumber && (
          <div className={row}>
            <dt className="text-neutral-500">{t('deal.order')}</dt>
            <dd>№ {deal.orderNumber}</dd>
          </div>
        )}
        {deal.lostReason && (
          <div className={row}>
            <dt className="text-neutral-500">{t('deal.lostReason')}</dt>
            <dd className="text-right">{deal.lostReason}</dd>
          </div>
        )}
      </dl>

      {!closed && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!stage) return;
            void act(() =>
              changeDealStage(deal.id, {
                stage,
                lostReason: stage === DealStage.LOST ? lostReason : undefined,
              }),
            );
          }}
        >
          <label className="block">
            {t('deal.move')}
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={stage}
              onChange={(e) => setStage(e.target.value as DealStageT | '')}
            >
              <option value="">—</option>
              {Object.values(DealStage)
                .filter((s) => s !== deal.stage)
                .map((s) => (
                  <option key={s} value={s}>
                    {t(`stages.${s}`)}
                  </option>
                ))}
            </select>
          </label>
          {stage === DealStage.LOST && (
            <label className="block">
              {t('deal.lostReason')}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={lostReason}
                placeholder={t('deal.lostReasonPlaceholder')}
                onChange={(e) => setLostReason(e.target.value)}
              />
            </label>
          )}
          <button
            type="submit"
            disabled={!stage || (stage === DealStage.LOST && !lostReason.trim())}
            className="rounded-lg bg-brand px-4 py-1.5 font-semibold text-black disabled:opacity-50"
          >
            {t('deal.apply')}
          </button>
        </form>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">{t('deal.tasks')}</h3>
        {deal.tasks.length === 0 && <p className="text-neutral-500">{t('deal.noTasks')}</p>}
        <ul className="space-y-1">
          {deal.tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={(done) => act(() => setTaskDone(task.id, done))}
            />
          ))}
        </ul>
        <form
          className="grid grid-cols-[1fr_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () =>
                createTask({
                  title: taskTitle,
                  dealId: deal.id,
                  dueAt: taskDue ? new Date(taskDue).toISOString() : undefined,
                }),
              () => {
                setTaskTitle('');
                setTaskDue('');
              },
            );
          }}
        >
          <input
            className="col-span-2 rounded border px-2 py-1"
            placeholder={t('deal.taskTitle')}
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <input
            type="datetime-local"
            aria-label={t('deal.due')}
            className="rounded border px-2 py-1"
            value={taskDue}
            onChange={(e) => setTaskDue(e.target.value)}
          />
          <button
            type="submit"
            disabled={taskTitle.trim().length < 2}
            className="rounded border border-neutral-300 px-3 py-1 disabled:opacity-50"
          >
            {t('deal.addTask')}
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">{t('deal.activities')}</h3>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () => addActivity({ type: activityType, content: activityText, dealId: deal.id }),
              () => setActivityText(''),
            );
          }}
        >
          <div className="flex gap-2">
            <select
              aria-label={t('deal.activityType')}
              className="rounded border px-2 py-1"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
            >
              {ACTIVITY_TYPES.map((a) => (
                <option key={a} value={a}>
                  {t(`activityTypes.${a}`)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!activityText.trim()}
              className="rounded border border-neutral-300 px-3 py-1 disabled:opacity-50"
            >
              {t('deal.addActivity')}
            </button>
          </div>
          <textarea
            className="w-full rounded border px-2 py-1"
            rows={2}
            placeholder={t('deal.activityPlaceholder')}
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
          />
        </form>
        <ol className="space-y-2">
          {deal.activities.map((a) => (
            <li key={a.id} className="border-l-2 border-neutral-200 pl-3">
              <p className="text-xs text-neutral-500">
                {fmtDate(a.createdAt)} · {t(`activityTypes.${a.type}`)}
                {a.author && ` · ${a.author}`}
              </p>
              <p className="whitespace-pre-line">{a.content}</p>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function TaskItem({
  task,
  onToggle,
  onOpenDeal,
}: {
  task: CrmTask;
  onToggle: (done: boolean) => void;
  onOpenDeal?: (id: string) => void;
}) {
  const t = useTranslations('crm');
  const fmtDate = useDateFormat();
  // Галочка реагує одразу, не чекаючи перечитування списку.
  const [done, setDone] = useState(task.done);
  useEffect(() => setDone(task.done), [task.done]);
  return (
    <li className="flex items-start gap-2" data-task={task.id}>
      <input
        type="checkbox"
        className="mt-1"
        aria-label={task.title}
        checked={done}
        onChange={(e) => {
          setDone(e.target.checked);
          onToggle(e.target.checked);
        }}
      />
      <div>
        <p className={done ? 'text-neutral-400 line-through' : ''}>{task.title}</p>
        <p className="text-xs text-neutral-500">
          {task.dueAt && (
            <span className={task.overdue ? 'font-medium text-red-600' : ''}>
              {fmtDate(task.dueAt)}
              {task.overdue && ` · ${t('tasks.overdue')}`}
            </span>
          )}
          {task.assignee && ` · ${task.assignee.email}`}
          {onOpenDeal && task.dealId && (
            <>
              {' · '}
              <button
                className="text-brand-dark hover:underline"
                onClick={() => onOpenDeal(task.dealId!)}
              >
                {t('tasks.openDeal')}
              </button>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

function TasksTab({
  mine,
  version,
  onChanged,
  onOpenDeal,
}: {
  mine: boolean;
  version: number;
  onChanged: () => void;
  onOpenDeal: (id: string) => void;
}) {
  const t = useTranslations('crm');
  const [showDone, setShowDone] = useState(false);
  const {
    data: tasks,
    error,
    setError,
  } = useLoad(() => fetchTasks({ mine, done: showDone }), [mine, showDone, version]);

  return (
    <section className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        {t('tasks.showDone')}
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {tasks && tasks.length === 0 && <p className="text-neutral-500">{t('tasks.empty')}</p>}
      {tasks && tasks.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-neutral-200 p-4 text-sm">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onOpenDeal={onOpenDeal}
              onToggle={async (done) => {
                try {
                  await setTaskDone(task.id, done);
                  onChanged();
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

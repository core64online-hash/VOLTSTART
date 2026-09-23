import type {
  ChangeDealStageInput,
  ConvertLeadInput,
  CreateActivityInput,
  CreateLeadInput,
  CreateTaskInput,
  CrmTask,
  Deal,
  DealDetail,
  Lead,
  LeadStatus,
  Pipeline,
} from '@voltstar/types';
import { apiJson } from './http';

const q = (params: Record<string, string | boolean | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== false) s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

/** Публічна заявка: форма підбору, запит бізнесу/держсектору. */
export async function submitLead(input: CreateLeadInput): Promise<void> {
  await apiJson<{ received: boolean }>('/crm/leads', { method: 'POST', body: input });
}

export function fetchLeads(filter: { status?: LeadStatus; mine?: boolean } = {}): Promise<Lead[]> {
  return apiJson<Lead[]>(`/crm/leads${q(filter)}`);
}

export function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  return apiJson<Lead>(`/crm/leads/${id}`, { method: 'PATCH', body: { status } });
}

export function convertLead(id: string, input: Partial<ConvertLeadInput> = {}): Promise<Deal> {
  return apiJson<Deal>(`/crm/leads/${id}/convert`, { method: 'POST', body: input });
}

export function fetchPipeline(mine = false): Promise<Pipeline> {
  return apiJson<Pipeline>(`/crm/pipeline${q({ mine })}`);
}

export function fetchDeal(id: string): Promise<DealDetail> {
  return apiJson<DealDetail>(`/crm/deals/${id}`);
}

export function changeDealStage(id: string, input: ChangeDealStageInput): Promise<Deal> {
  return apiJson<Deal>(`/crm/deals/${id}/stage`, { method: 'PATCH', body: input });
}

export function addActivity(input: CreateActivityInput): Promise<{ id: string }> {
  return apiJson<{ id: string }>('/crm/activities', { method: 'POST', body: input });
}

export function fetchTasks(filter: { mine?: boolean; done?: boolean } = {}): Promise<CrmTask[]> {
  return apiJson<CrmTask[]>(`/crm/tasks${q(filter)}`);
}

export function createTask(input: CreateTaskInput): Promise<CrmTask> {
  return apiJson<CrmTask>('/crm/tasks', { method: 'POST', body: input });
}

export function setTaskDone(id: string, done: boolean): Promise<CrmTask> {
  return apiJson<CrmTask>(`/crm/tasks/${id}`, { method: 'PATCH', body: { done } });
}

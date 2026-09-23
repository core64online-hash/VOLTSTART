import type {
  AdminOrganization,
  AdminProduct,
  AdminProductInput,
  AdminProductUpdate,
  AdminUser,
  Analytics,
  AuditEntry,
  CatalogRefs,
  OrderDetail,
  OrderStatus,
  Page,
  Role,
  SetPriceInput,
  StaffOrderSummary,
} from '@voltstar/types';
import { apiJson } from './http';

const q = (params: Record<string, string | number | boolean | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

// ─── Аналітика ───
export const fetchAnalytics = (period: { from?: string; to?: string }) =>
  apiJson<Analytics>(`/admin/analytics${q(period)}`);

// ─── Замовлення ───
export const fetchStaffOrders = (f: { status?: OrderStatus; q?: string; page?: number }) =>
  apiJson<Page<StaffOrderSummary>>(`/orders/manage${q(f)}`);
export const fetchStaffOrder = (number: string) =>
  apiJson<OrderDetail>(`/orders/${encodeURIComponent(number)}`);
export const changeOrderStatus = (number: string, status: OrderStatus, note?: string) =>
  apiJson<OrderDetail>(`/orders/${encodeURIComponent(number)}/status`, {
    method: 'PATCH',
    body: { status, note },
  });
export const markOrderPaid = (number: string) =>
  apiJson<{ orderNumber: string; status: string }>(
    `/payments/orders/${encodeURIComponent(number)}/mark-paid`,
    {
      method: 'POST',
    },
  );

// ─── Каталог ───
export const fetchCatalogRefs = () => apiJson<CatalogRefs>('/admin/catalog/refs');
export const fetchAdminProducts = (f: { q?: string; page?: number }) =>
  apiJson<Page<AdminProduct>>(`/admin/products${q(f)}`);
export const fetchAdminProduct = (id: string) => apiJson<AdminProduct>(`/admin/products/${id}`);
export const createProduct = (input: AdminProductInput) =>
  apiJson<AdminProduct>('/admin/products', { method: 'POST', body: input });
export const updateProduct = (id: string, input: AdminProductUpdate) =>
  apiJson<AdminProduct>(`/admin/products/${id}`, { method: 'PATCH', body: input });
export const setProductPrice = (id: string, priceListId: string, input: SetPriceInput) =>
  apiJson<AdminProduct>(`/admin/products/${id}/prices/${priceListId}`, {
    method: 'PUT',
    body: input,
  });
export const removeProductPrice = (id: string, priceListId: string) =>
  apiJson<AdminProduct>(`/admin/products/${id}/prices/${priceListId}`, { method: 'DELETE' });
export const setProductStock = (id: string, quantity: number) =>
  apiJson<AdminProduct>(`/admin/products/${id}/stock`, { method: 'PUT', body: { quantity } });

// ─── Клієнти ───
export const fetchAdminUsers = (f: { q?: string; role?: Role; page?: number }) =>
  apiJson<Page<AdminUser>>(`/admin/users${q(f)}`);
export const setUserRole = (id: string, role: Exclude<Role, 'GUEST'>) =>
  apiJson<AdminUser>(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } });
export const fetchOrganizations = (f: { verified?: boolean; q?: string; page?: number }) =>
  apiJson<Page<AdminOrganization>>(`/admin/organizations${q(f)}`);
export const verifyOrganization = (id: string) =>
  apiJson<unknown>(`/accounts/organizations/${id}/verify`, { method: 'POST' });

// ─── Журнал ───
export const fetchAudit = (f: {
  entity?: string;
  entityId?: string;
  action?: string;
  page?: number;
}) => apiJson<Page<AuditEntry>>(`/admin/audit${q(f)}`);

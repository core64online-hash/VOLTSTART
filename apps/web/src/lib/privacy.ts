import { apiFetch, apiJson } from './http';

/** Завантажує JSON з усіма своїми даними (запит із токеном, тож через blob). */
export async function downloadMyData(): Promise<void> {
  const res = await apiFetch('/accounts/me/export');
  const blob = new Blob([await res.text()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voltstar-my-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function deleteMyAccount(password: string): Promise<{ deleted: boolean }> {
  return apiJson('/accounts/me/delete', { method: 'POST', body: { password } });
}

#!/usr/bin/env node
/**
 * Запуск деплою ресурсу в Coolify через API і очікування завершення.
 *   COOLIFY_URL=https://coolify.example COOLIFY_TOKEN=… node scripts/coolify-deploy.mjs <resource-uuid>
 * Токен — Coolify → Keys & Tokens → API tokens (право deploy). Код виходу ≠ 0, якщо деплой не вдався.
 */
const [uuid] = process.argv.slice(2);
const base = (process.env.COOLIFY_URL ?? '').replace(/\/$/, '');
const token = process.env.COOLIFY_TOKEN;
if (!uuid || !base || !token) {
  console.error('Потрібні COOLIFY_URL, COOLIFY_TOKEN і uuid ресурсу');
  process.exit(2);
}
const api = async (path) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Coolify ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
};

async function main() {
  const started = await api(`/deploy?uuid=${encodeURIComponent(uuid)}&force=false`);
  const deployment = started.deployments?.[0]?.deployment_uuid;
  console.log(`▶ Деплой запущено${deployment ? `: ${deployment}` : ''}`);
  if (!deployment) return; // старі версії Coolify не повертають id — далі чекають smoke-тести

  const deadline = Date.now() + 30 * 60 * 1000;
  for (;;) {
    const d = await api(`/deployments/${deployment}`);
    const status = d.status ?? 'unknown';
    if (['finished', 'success'].includes(status)) {
      console.log('✅ Деплой завершено');
      break;
    }
    if (['failed', 'cancelled', 'cancelled-by-user', 'error'].includes(status)) {
      console.error(`❌ Деплой завершився зі статусом ${status}`);
      process.exit(1);
    }
    if (Date.now() > deadline) {
      console.error('❌ Деплой не завершився за 30 хв');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, Number(process.env.COOLIFY_POLL_MS ?? 10_000)));
  }
}

main().catch((e) => {
  console.error(`❌ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

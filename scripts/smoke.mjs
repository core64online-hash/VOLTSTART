#!/usr/bin/env node
/**
 * Smoke-тести після деплою: сайт, API, БД, пошук, SEO-файли, заголовки безпеки.
 * Код виходу ≠ 0 при будь-якому провалі — пайплайн деплою робить відкат.
 *
 *   node scripts/smoke.mjs https://voltstar.ua [--version <очікувана APP_VERSION>] [--retries 20]
 *
 * Для самопідписаного TLS (staging із `tls internal`) — NODE_EXTRA_CA_CERTS=<root.crt>.
 */
import { parseArgs } from 'node:util';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { version: { type: 'string' }, retries: { type: 'string', default: '20' } },
});
const BASE = (positionals[0] ?? process.env.SMOKE_URL ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('Використання: node scripts/smoke.mjs <https://домен> [--version X]');
  process.exit(2);
}
const HTTPS = BASE.startsWith('https://');
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const get = (path, init) => fetch(BASE + path, { redirect: 'manual', ...init });

// 1. Чекаємо готовності (після деплою контейнери стартують кілька секунд).
let ready = null;
for (let i = 0; i < Number(opts.retries); i++) {
  try {
    const r = await get('/api/health/ready');
    if (r.ok) {
      ready = await r.json();
      break;
    }
  } catch {
    /* ще не піднявся */
  }
  await new Promise((r) => setTimeout(r, 3000));
}
check(
  'API готовий, база даних відповідає',
  ready?.status === 'ready' && ready.database?.ok,
  ready ? `${ready.database.latencyMs} мс` : 'немає відповіді',
);
if (!ready) process.exit(1);
if (opts.version)
  check(
    'задеплоєно очікувану версію',
    ready.version === opts.version,
    `${ready.version} ≠ ${opts.version}`.replace(/^(.+) ≠ \1$/, '$1'),
  );

// 2. Сайт і SEO
const home = await get('/uk');
const html = await home.text();
check(
  'головна сторінка',
  home.status === 200 && /<title>[^<]+<\/title>/.test(html),
  String(home.status),
);
const root = await get('/');
check('корінь веде на мовну версію', [200, 307, 308].includes(root.status), String(root.status));
check('canonical на правильний домен', html.includes(`<link rel="canonical" href="${BASE}/uk"`));
const csp = home.headers.get('content-security-policy') ?? '';
check(
  'CSP і захисні заголовки сайту',
  csp.includes("frame-ancestors 'none'") &&
    home.headers.get('x-content-type-options') === 'nosniff',
);
if (HTTPS) check('HSTS', /max-age=\d+/.test(home.headers.get('strict-transport-security') ?? ''));
for (const p of ['/robots.txt', '/sitemap.xml']) {
  const r = await get(p);
  check(p, r.status === 200 && (await r.text()).length > 20);
}

// 3. Каталог через API і сайт
const list = await get('/api/catalog/products?perPage=1');
const products = list.ok ? await list.json() : null;
check(
  'каталог API',
  list.ok && Array.isArray(products?.items),
  `${products?.total ?? '?'} товарів`,
);
check('каталог кешується публічно', /public/.test(list.headers.get('cache-control') ?? ''));
const catalog = await get('/uk/catalog');
check('сторінка каталогу', catalog.status === 200);
const slug = products?.items?.[0]?.slug;
if (slug) {
  const page = await get(`/uk/catalog/${slug}`);
  const body = await page.text();
  check(
    'сторінка товару з розміткою Product',
    page.status === 200 && body.includes('"@type":"Product"'),
    slug,
  );
}
check('неіснуючий товар — 404', (await get('/uk/catalog/__smoke-missing__')).status === 404);

// 4. Службові маршрути закриті
check('метрики не доступні ззовні', (await get('/api/metrics')).status === 404);
const docs = await get('/docs');
check('Swagger вимкнено', docs.status === 404 || docs.status >= 300);

console.log(
  failed
    ? `\n❌ Smoke-тести не пройдено: ${failed}`
    : `\n✅ Smoke-тести пройдено (${BASE}, версія ${ready.version})`,
);
process.exit(failed ? 1 : 0);

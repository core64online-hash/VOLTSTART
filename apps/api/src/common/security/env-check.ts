/**
 * Перевірка конфігурації під час старту. У production небезпечні або відсутні налаштування —
 * фатальні (краще не стартувати, ніж працювати з дефолтним JWT-секретом чи sandbox-оплатами).
 */
export interface EnvReport {
  errors: string[];
  warnings: string[];
}

const DEV_JWT_SECRETS = new Set(['change_me_in_production', 'dev-insecure-secret']);
const SECRET_KEYS = ['JWT_SECRET', 'INTERNAL_API_TOKEN', 'TYPESENSE_API_KEY', 'METRICS_TOKEN', 'DATABASE_URL'] as const;
const isHttps = (url: string | undefined) => !!url && /^https:\/\//i.test(url.trim());

export function checkEnv(env: Record<string, string | undefined>): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = env.NODE_ENV === 'production';
  const problem = (msg: string) => (prod ? errors : warnings).push(msg);

  const secret = env.JWT_SECRET ?? '';
  if (!secret || DEV_JWT_SECRETS.has(secret)) problem('JWT_SECRET не задано або це значення-приклад');
  else if (secret.length < 32) problem('JWT_SECRET закороткий (потрібно щонайменше 32 символи)');

  if (!env.DATABASE_URL) errors.push('DATABASE_URL не задано');

  // Значення-заглушки: текст підказки («задайте …») чи непідставлений шаблон «${…}», який
  // панель деплою (напр. Coolify) могла взяти з compose-файла як значення змінної.
  for (const key of SECRET_KEYS) {
    const v = env[key];
    if (v && (/^задайте/i.test(v) || v.includes('${'))) errors.push(`${key} містить заглушку замість значення`);
  }

  const origins = (env.API_CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.includes('*')) errors.push('API_CORS_ORIGINS не може містити "*" (використовуються credentials)');
  if (prod) {
    if (origins.length === 0) errors.push('API_CORS_ORIGINS не задано');
    for (const o of origins) if (!isHttps(o)) errors.push(`CORS-origin без HTTPS: ${o}`);
    if (!isHttps(env.WEB_PUBLIC_URL)) errors.push('WEB_PUBLIC_URL має бути https:// (посилання в листах)');
    if (!isHttps(env.API_PUBLIC_URL)) errors.push('API_PUBLIC_URL має бути https:// (вебхуки платіжних систем)');
    if (env.LIQPAY_SANDBOX === 'true') errors.push('LIQPAY_SANDBOX=true у production — тестові оплати зараховувались би як справжні');
    if (env.RATE_LIMIT_DISABLED === 'true') errors.push('RATE_LIMIT_DISABLED=true у production');
    if (env.TYPESENSE_HOST && env.TYPESENSE_API_KEY === 'voltstar_dev_key') errors.push('TYPESENSE_API_KEY — значення-приклад');
    if (!env.SMTP_HOST) warnings.push('SMTP_HOST не задано — листи покупцям лише пишуться в лог');
    if (!env.TRUST_PROXY) warnings.push('TRUST_PROXY не задано — за балансувальником ліміти рахуватимуться за його IP');
    if (!env.METRICS_TOKEN) warnings.push('METRICS_TOKEN не задано — /api/metrics у production вимкнено');
    if (!env.INTERNAL_API_TOKEN) warnings.push('INTERNAL_API_TOKEN не задано — SSR сайту підпадатиме під ліміти запитів за IP');
    else if (env.INTERNAL_API_TOKEN.length < 32) errors.push('INTERNAL_API_TOKEN закороткий (потрібно щонайменше 32 символи)');
  }
  return { errors, warnings };
}

/** Кількість довірених проксі для Express (`trust proxy`): число, true/false або список підмереж. */
export function trustProxySetting(value: string | undefined): boolean | number | string {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : value;
}

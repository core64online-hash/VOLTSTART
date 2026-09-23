import type { Metadata } from 'next';
import { routing } from '../i18n/routing';

/** Публічна адреса сайту — для canonical, hreflang, sitemap і Open Graph. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'VOLTSTAR';

const OG_LOCALE: Record<string, string> = { uk: 'uk_UA', en: 'en_US' };

/** Абсолютна адреса сторінки в заданій мові; `path` — без префікса мови ('' | '/catalog' …). */
export const localizedUrl = (locale: string, path = '') => `${SITE_URL}/${locale}${path}`;

/** canonical на поточну мову + hreflang на всі мови (x-default — мова за замовчуванням). */
export function alternatesFor(locale: string, path = ''): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedUrl(l, path);
  languages['x-default'] = localizedUrl(routing.defaultLocale, path);
  return { canonical: localizedUrl(locale, path), languages };
}

/** Метадані публічної сторінки: заголовок, опис, canonical/hreflang, Open Graph. */
export function pageMetadata(opts: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  /** Не додавати « — VOLTSTAR» (головна вже містить назву). */
  absoluteTitle?: boolean;
}): Metadata {
  const { locale, path, title, description, image } = opts;
  return {
    title: opts.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type: opts.type ?? 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: localizedUrl(locale, path),
      locale: OG_LOCALE[locale] ?? locale,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  };
}

/** Службові сторінки (кабінет, кошик, адмінка) не індексуються. */
export const NO_INDEX: Metadata = { robots: { index: false, follow: false } };

/** Безпечна серіалізація JSON-LD для <script> (без закриття тегу зсередини). */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

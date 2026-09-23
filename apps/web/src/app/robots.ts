import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/seo';

/** Службові розділи (кабінет, кошик, адмінка) не індексуються — на них ще й meta robots=noindex. */
const PRIVATE = ['account', 'admin', 'manager', 'cart', 'checkout', 'orders', 'login', 'register', 'forgot-password', 'reset-password'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE.map((p) => `/*/${p}`) }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

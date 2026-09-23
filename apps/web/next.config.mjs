import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
// Звіти про помилки браузера (Sentry) — дозволяємо запити лише на хост із DSN.
const sentryOrigin = process.env.NEXT_PUBLIC_SENTRY_DSN ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin : '';

/**
 * Content-Security-Policy. Next.js вбудовує inline-скрипти гідрації, тож без nonce-режиму
 * (який вимикає статичну генерацію сторінок) 'unsafe-inline' для скриптів лишається;
 * решта директив сувора: скрипти й запити — лише свій домен і API, форми — лише на платіжні шлюзи,
 * вбудовування сайту в чужі фрейми заборонене.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${sentryOrigin ? ` ${sentryOrigin}` : ''}${isDev ? ' ws:' : ''}`,
  "form-action 'self' https://secure.wayforpay.com https://www.liqpay.ua",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Лише коли сам API на HTTPS (локальний production-запуск із http-API інакше зламався б).
  ...(!isDev && apiOrigin.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker-образ: мінімальний самодостатній сервер; трасування залежностей — від кореня монорепо.
  ...(process.env.NEXT_STANDALONE === 'true'
    ? { output: 'standalone', outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)) }
    : {}),
  // Метадані (title, description, canonical, OG) — завжди в <head>, а не стрімом у <body>:
  // інакше їх не бачать прев'ю посилань у месенджерах і частина пошукових роботів.
  htmlLimitedBots: /.*/,
  transpilePackages: ['@voltstar/ui', '@voltstar/types'],
  // Серверний SDK Sentry — як звичайний пакет Node, без бандлінгу (інакше попередження збірки й зайвий розмір).
  serverExternalPackages: ['@sentry/node'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);

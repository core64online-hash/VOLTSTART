import { NextResponse, type NextRequest } from 'next/server';
import { routing, type Locale } from '../../../../i18n/routing';

/**
 * Точка повернення з платіжної сторінки. WayForPay повертає покупця POST-запитом,
 * тож відповідаємо 303 на сторінку результату (GET). Статус оплати визначає
 * вебхук на API, а не параметри цього запиту.
 */
async function redirectToResult(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale;
  return NextResponse.redirect(new URL(`/${safeLocale}/checkout/result`, req.url), 303);
}

export const GET = redirectToResult;
export const POST = redirectToResult;

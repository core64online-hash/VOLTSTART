import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Пропускаємо API, статику Next та файли з розширенням.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

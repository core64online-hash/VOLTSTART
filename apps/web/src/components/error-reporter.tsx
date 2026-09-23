'use client';

import { useEffect } from 'react';
import { initErrorReporting } from '../lib/error-reporting';

/** Підключає звіти про необроблені помилки браузера (якщо задано NEXT_PUBLIC_SENTRY_DSN). */
export function ErrorReporter() {
  useEffect(() => {
    void initErrorReporting();
  }, []);
  return null;
}

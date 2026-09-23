'use client';

import { useEffect } from 'react';
import { reportClientError } from '../lib/error-reporting';

/** Збій кореневого макета (переклади ще недоступні) — двомовне повідомлення + звіт у Sentry. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="uk">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '96px 16px' }}>
        <h1>Щось пішло не так · Something went wrong</h1>
        <p>Спробуйте ще раз за хвилину. · Please try again in a minute.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px' }}>
          Спробувати ще раз · Try again
        </button>
      </body>
    </html>
  );
}

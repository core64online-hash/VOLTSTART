import { useEffect, useState } from 'react';

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Завантаження з повтором при зміні залежностей; помилка показується над вмістом. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, deps);
  return { data, error, setError, setData };
}

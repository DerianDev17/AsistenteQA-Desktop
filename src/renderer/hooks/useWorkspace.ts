import { useCallback, useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../application/workspace';
import type { Result } from '../../shared/api';

export async function unwrap<T>(request: Promise<Result<T>>) {
  const result = await request;
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
async function loadSnapshot() {
  if (!window.qa)
    throw new Error('Abre la aplicación con npm run dev para acceder a tus datos locales.');
  return unwrap(window.qa.snapshot());
}
export function useWorkspace() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const requests = useRef(0);
  const invalidate = useCallback(() => {
    requests.current++;
  }, []);
  const refresh = useCallback(() => {
    const current = ++requests.current;
    return loadSnapshot().then(
      (next) => {
        if (current === requests.current) {
          setData(next);
          setError('');
        }
      },
      (reason) => {
        if (current === requests.current)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos.');
      },
    );
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      invalidate();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh, invalidate]);
  const mutate = async <T>(request: Promise<Result<T>>) => {
    const result = await unwrap(request);
    await refresh();
    return result;
  };
  return { data, error, refresh, mutate };
}

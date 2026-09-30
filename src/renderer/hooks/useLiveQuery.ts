import { useCallback, useEffect, useRef, useState } from 'react';
export function useLiveQuery<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const requests = useRef(0);
  const invalidate = useCallback(() => {
    requests.current++;
  }, []);
  const refresh = useCallback(() => {
    const request = ++requests.current;
    return Promise.resolve()
      .then(load)
      .then(
        (value) => {
          if (request === requests.current) {
            setData(value);
            setError('');
          }
        },
        (reason) => {
          if (request === requests.current)
            setError(
              reason instanceof Error ? reason.message : 'No se pudo cargar la información.',
            );
        },
      );
  }, [load]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      invalidate();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh, invalidate]);
  return { data, error, refresh };
}

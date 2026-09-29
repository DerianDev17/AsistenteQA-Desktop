import { useCallback, useEffect, useRef, useState } from 'react';
import type { MailPage, MailStatus } from '../../domain/email';
import { unwrap } from './useWorkspace';

async function loadMailSummary() {
  const status = await unwrap(window.qa.mail.status());
  const inbox = status.connected
    ? await unwrap(window.qa.mail.list(0))
    : { messages: [], total: 0, page: 0, pageSize: 50 };
  return { status, inbox };
}

export function useMailSummary() {
  const [data, setData] = useState<{ status: MailStatus; inbox: MailPage } | null>(null);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [working, setWorking] = useState(false);
  const requests = useRef(0);
  const syncing = useRef(false);
  const invalidate = useCallback(() => {
    requests.current++;
  }, []);
  const refresh = useCallback(() => {
    const request = ++requests.current;
    return loadMailSummary().then(
      (next) => {
        if (request === requests.current) {
          setData(next);
          setError('');
        }
      },
      (reason) => {
        if (request === requests.current)
          setError(reason instanceof Error ? reason.message : 'No se pudo cargar el correo.');
      },
    );
  }, []);
  useEffect(() => {
    void refresh();
    // Read the local cache; Microsoft synchronization keeps its own five-minute schedule.
    const timer = setInterval(() => void refresh(), 5000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      invalidate();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh, invalidate]);
  const sync = async () => {
    if (syncing.current) return;
    syncing.current = true;
    setWorking(true);
    setSyncError('');
    try {
      await unwrap(window.qa.mail.sync());
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : 'No se pudo sincronizar el correo.');
    } finally {
      syncing.current = false;
      setWorking(false);
      await refresh();
    }
  };
  return { data, error: error || syncError || data?.status.error || '', working, refresh, sync };
}

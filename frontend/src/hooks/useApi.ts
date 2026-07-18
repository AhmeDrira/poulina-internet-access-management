import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../api/client';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Relance l'appel (ex : après une action de mutation) */
  reload: () => void;
}

/**
 * Hook générique de chargement de données :
 * gère loading / error / rechargement, et ignore les réponses obsolètes.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    const currentCall = ++callId.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (callId.current === currentCall) {
          setData(result);
        }
      })
      .catch((err) => {
        if (callId.current === currentCall) {
          setError(getApiErrorMessage(err));
        }
      })
      .finally(() => {
        if (callId.current === currentCall) {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadIndex]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  return { data, loading, error, reload };
}

import { useEffect, useState } from 'react';
import { aiApi, AiStatus } from '../api/ai.api';

const DISABLED: AiStatus = { enabled: false, summaryThreshold: 400 };

/** Une seule interrogation du serveur par session, partagée par tous les composants */
let cached: Promise<AiStatus> | null = null;

function loadStatus(): Promise<AiStatus> {
  if (!cached) {
    cached = aiApi.status().catch(() => DISABLED);
  }
  return cached;
}

/**
 * Disponibilité de l'assistance à la rédaction.
 * Sans clé API côté serveur, `enabled` reste faux et les boutons IA
 * n'apparaissent pas : l'application fonctionne normalement sans l'IA.
 */
export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>(DISABLED);

  useEffect(() => {
    let cancelled = false;
    loadStatus().then((value) => {
      if (!cancelled) setStatus(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

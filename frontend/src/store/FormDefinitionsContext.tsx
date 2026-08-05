import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formsApi } from '../api/forms.api';
import { FormDefinition, RequestType } from '../types';
import { REQUEST_TYPE_FULL_LABELS, REQUEST_TYPE_LABELS } from '../utils/labels';
import { describeFormData, DescribedCommitment, DescribedEntry } from '../utils/formDefinitions';

interface FormDefinitionsValue {
  /** Définitions renvoyées par l'API (inactives incluses pour les administrateurs) */
  definitions: FormDefinition[];
  /** Formulaires proposables à un employé */
  activeDefinitions: FormDefinition[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Définition d'un type, ou undefined si l'API n'a pas encore répondu */
  get: (type: RequestType) => FormDefinition | undefined;
  /** Intitulé complet (repli sur les libellés livrés si l'API est indisponible) */
  titleOf: (type: RequestType) => string;
  /** Libellé court pour badges et tableaux */
  shortLabelOf: (type: RequestType) => string;
  /** Contenu rempli d'une demande, prêt à afficher */
  describe: (
    type: RequestType,
    formData: Record<string, unknown> | undefined,
  ) => { entries: DescribedEntry[]; commitments: DescribedCommitment[] };
}

const FormDefinitionsContext = createContext<FormDefinitionsValue | null>(null);

/**
 * Charge une seule fois les définitions de formulaires pour toute la session
 * authentifiée. Elles sont modifiables par le super administrateur : les écrans
 * de saisie, de validation et de détail s'y adaptent sans redéploiement.
 */
export function FormDefinitionsProvider({ children }: { children: ReactNode }) {
  const [definitions, setDefinitions] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    formsApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setDefinitions(data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la définition des formulaires.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const byType = useMemo(() => {
    const map = new Map<RequestType, FormDefinition>();
    for (const definition of definitions) {
      map.set(definition.requestType, definition);
    }
    return map;
  }, [definitions]);

  const get = useCallback((type: RequestType) => byType.get(type), [byType]);

  const titleOf = useCallback(
    (type: RequestType) => byType.get(type)?.title || REQUEST_TYPE_FULL_LABELS[type],
    [byType],
  );

  const shortLabelOf = useCallback(
    (type: RequestType) => byType.get(type)?.shortLabel || REQUEST_TYPE_LABELS[type],
    [byType],
  );

  const describe = useCallback(
    (type: RequestType, formData: Record<string, unknown> | undefined) =>
      describeFormData(byType.get(type), formData),
    [byType],
  );

  const value = useMemo<FormDefinitionsValue>(
    () => ({
      definitions,
      activeDefinitions: definitions.filter((definition) => definition.isActive),
      loading,
      error,
      reload: () => setReloadKey((key) => key + 1),
      get,
      titleOf,
      shortLabelOf,
      describe,
    }),
    [definitions, loading, error, get, titleOf, shortLabelOf, describe],
  );

  return (
    <FormDefinitionsContext.Provider value={value}>{children}</FormDefinitionsContext.Provider>
  );
}

export function useFormDefinitions(): FormDefinitionsValue {
  const context = useContext(FormDefinitionsContext);
  if (!context) {
    throw new Error('useFormDefinitions doit être utilisé dans un FormDefinitionsProvider');
  }
  return context;
}

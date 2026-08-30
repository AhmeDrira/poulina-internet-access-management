import { useState } from 'react';
import { ListCollapse } from 'lucide-react';
import { aiApi, JustificationSummary as SummaryData } from '../../api/ai.api';
import { getApiErrorMessage } from '../../api/client';
import { useAiStatus } from '../../hooks/useAiStatus';
import { useToast } from '../../store/ToastContext';
import { Button } from '../ui/Button';

interface JustificationSummaryProps {
  requestId: string;
  justification: string;
}

/**
 * Synthèse d'une justification longue, à la demande du validateur.
 *
 * La justification complète reste toujours affichée : la synthèse s'ajoute
 * au-dessus pour dégrossir la lecture, elle ne la remplace jamais.
 */
export function JustificationSummaryPanel({
  requestId,
  justification,
}: JustificationSummaryProps) {
  const { enabled, summaryThreshold } = useAiStatus();
  const toast = useToast();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  // Sur une justification déjà courte, résumer n'apporterait rien
  if (!enabled || justification.trim().length < summaryThreshold) {
    return null;
  }

  const handleSummarize = async () => {
    setLoading(true);
    try {
      setSummary(await aiApi.summarize(requestId));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (summary) {
    return (
      <div className="ai-summary">
        <div className="ai-summary-header">
          <ListCollapse size={15} />
          <span>Synthèse de la justification</span>
        </div>
        <p className="ai-summary-text">{summary.summary}</p>
        {summary.bullets.length > 0 && (
          <ul className="ai-summary-bullets">
            {summary.bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}
        <div className="text-small text-muted">
          Résumé généré par IA à partir du texte du demandeur — la justification complète reste
          affichée ci-dessous.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={<ListCollapse size={15} />}
        loading={loading}
        onClick={handleSummarize}
      >
        Résumer cette justification
      </Button>
      <span className="text-small text-muted" style={{ marginLeft: 8 }}>
        {justification.trim().length} caractères
      </span>
    </div>
  );
}

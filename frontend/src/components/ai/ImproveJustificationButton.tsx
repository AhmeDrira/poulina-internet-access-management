import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { aiApi, ImprovedJustification } from '../../api/ai.api';
import { getApiErrorMessage } from '../../api/client';
import { useAiStatus } from '../../hooks/useAiStatus';
import { useToast } from '../../store/ToastContext';
import { AccessType, DurationType, RequestType } from '../../types';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ImproveJustificationButtonProps {
  requestType: RequestType;
  draft: string;
  accessType?: AccessType;
  durationType?: DurationType;
  durationDays?: number;
  /** Appelé uniquement si l'employé accepte explicitement la reformulation */
  onApply: (text: string) => void;
}

/** Longueur minimale exigée côté serveur avant de pouvoir reformuler */
const MIN_DRAFT_LENGTH = 15;

/**
 * Bouton d'assistance à la rédaction de la justification.
 *
 * La reformulation n'écrase jamais directement la saisie de l'employé :
 * elle est présentée côte à côte, et l'employé choisit de l'appliquer ou non.
 * Le bouton disparaît si l'assistance n'est pas configurée sur le serveur.
 */
export function ImproveJustificationButton({
  requestType,
  draft,
  accessType,
  durationType,
  durationDays,
  onApply,
}: ImproveJustificationButtonProps) {
  const { enabled } = useAiStatus();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImprovedJustification | null>(null);

  if (!enabled) return null;

  const tooShort = draft.trim().length < MIN_DRAFT_LENGTH;

  const handleImprove = async () => {
    setLoading(true);
    try {
      const improved = await aiApi.improveJustification({
        requestType,
        draft: draft.trim(),
        accessType,
        durationType,
        durationDays,
      });
      setResult(improved);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const applyResult = () => {
    if (result?.improved) {
      onApply(result.improved);
      toast.success('Justification remplacée par la version proposée.');
    }
    setResult(null);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={<Sparkles size={15} />}
        loading={loading}
        disabled={tooShort}
        title={
          tooShort
            ? `Écrivez d’abord quelques mots (${MIN_DRAFT_LENGTH} caractères minimum).`
            : 'Faire reformuler votre justification'
        }
        onClick={handleImprove}
      >
        Améliorer la rédaction
      </Button>

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title="Proposition de reformulation"
        width={720}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Garder mon texte
            </Button>
            {result?.improved && <Button onClick={applyResult}>Utiliser cette version</Button>}
          </>
        }
      >
        {result && (
          <>
            {!result.sufficient && (
              <Alert variant="warning">
                Votre brouillon manque d’éléments concrets pour être reformulé sans rien inventer.
                Complétez-le avec les précisions ci-dessous, puis relancez.
              </Alert>
            )}

            {result.notes.length > 0 && (
              <div className="ai-notes">
                <div className="detail-item-label">
                  {result.sufficient ? 'Ce qui a été clarifié' : 'Informations à ajouter'}
                </div>
                <ul>
                  {result.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ai-compare">
              <div>
                <div className="detail-item-label">Votre texte</div>
                <div className="justification-block">{draft.trim()}</div>
              </div>
              {result.improved && (
                <div>
                  <div className="detail-item-label">Proposition</div>
                  <div className="justification-block ai-suggestion">{result.improved}</div>
                </div>
              )}
            </div>

            <p className="text-small text-muted" style={{ marginTop: 12 }}>
              Rédaction assistée par IA à partir de votre brouillon : relisez-la et corrigez-la si
              nécessaire, elle reste sous votre responsabilité.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}

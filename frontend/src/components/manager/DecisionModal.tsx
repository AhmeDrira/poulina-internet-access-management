import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquareWarning, ThumbsDown, ThumbsUp } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { requestsApi } from '../../api/requests.api';
import { useToast } from '../../store/ToastContext';
import { AccessRequest, RecommendationLevel } from '../../types';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import {
  ACCESS_TYPE_LABELS,
  DURATION_LABELS,
  RECOMMENDATION_LABELS,
} from '../../utils/labels';
import { ScoreBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, Textarea } from '../ui/FormField';
import { Modal } from '../ui/Modal';

const SCORE_BAR_COLORS: Record<RecommendationLevel, string> = {
  [RecommendationLevel.LIKELY_LEGITIMATE]: 'var(--green-600)',
  [RecommendationLevel.NEEDS_REVIEW]: 'var(--amber-700)',
  [RecommendationLevel.RISKY]: 'var(--red-600)',
};

type Mode = 'idle' | 'approve' | 'reject' | 'changes';

interface DecisionModalProps {
  request: AccessRequest | null;
  open: boolean;
  onClose: () => void;
  onDecided: () => void;
}

/**
 * Modale d'examen d'une demande par le chef de département :
 * accepter, refuser (motif obligatoire) ou demander des modifications.
 */
export function DecisionModal({ request, open, onClose, onDecided }: DecisionModalProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const { titleOf, describe } = useFormDefinitions();
  const [mode, setMode] = useState<Mode>('idle');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('idle');
      setComment('');
      setReason('');
      setFieldError('');
    }
  }, [open, request?._id]);

  if (!request) return null;
  const decision = request.decisionSupport;
  const { entries: specificEntries } = describe(request.requestType, request.formData);

  const finish = (message: string) => {
    toast.success(message);
    onDecided();
    onClose();
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await requestsApi.approve(request._id, comment.trim() || undefined);
      finish("Demande acceptée et transmise à l'équipe réseau.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (reason.trim().length < 5) {
      setFieldError('Le motif de refus est obligatoire (5 caractères minimum).');
      return;
    }
    setFieldError('');
    setSubmitting(true);
    try {
      await requestsApi.reject(request._id, reason.trim(), comment.trim() || undefined);
      finish("Demande refusée. L'employé a été notifié.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (comment.trim().length < 5) {
      setFieldError('Précisez les modifications attendues (5 caractères minimum).');
      return;
    }
    setFieldError('');
    setSubmitting(true);
    try {
      await requestsApi.requestChanges(request._id, comment.trim());
      finish("Modifications demandées. L'employé pourra corriger et re-soumettre sa demande.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Examiner la demande ${request.reference}`} width={640}>
      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <div>
          <div className="detail-item-label">Type de formulaire</div>
          <div className="detail-item-value">{titleOf(request.requestType)}</div>
        </div>
        <div>
          <div className="detail-item-label">Demandeur</div>
          <div className="detail-item-value">
            {request.firstName} {request.lastName} ({request.matricule})
          </div>
        </div>
        <div>
          <div className="detail-item-label">Poste</div>
          <div className="detail-item-value">{request.position || '—'}</div>
        </div>
        <div>
          <div className="detail-item-label">Service</div>
          <div className="detail-item-value">{request.service?.name ?? '—'}</div>
        </div>
        {request.accessType && (
          <div>
            <div className="detail-item-label">Type d'accès</div>
            <div className="detail-item-value">{ACCESS_TYPE_LABELS[request.accessType]}</div>
          </div>
        )}
        <div>
          <div className="detail-item-label">Durée</div>
          <div className="detail-item-value">
            {request.durationDays
              ? `${DURATION_LABELS[request.durationType]} — ${request.durationDays} jours`
              : DURATION_LABELS[request.durationType]}
          </div>
        </div>
        {specificEntries.map((entry) => (
          <div key={entry.label}>
            <div className="detail-item-label">{entry.label}</div>
            <div className="detail-item-value">{entry.value}</div>
          </div>
        ))}
      </div>

      <div className="detail-item-label">Justification</div>
      <div className="justification-block" style={{ marginBottom: 16 }}>
        {request.justification}
      </div>

      {decision && (
        <div className="score-panel" style={{ marginBottom: 18 }}>
          <div className="score-panel-header">
            <span className="score-value">{decision.score}/100</span>
            <ScoreBadge decision={decision} />
          </div>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{ width: `${decision.score}%`, background: SCORE_BAR_COLORS[decision.level] }}
            />
          </div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {RECOMMENDATION_LABELS[decision.level]}
          </div>
          {decision.reasons.length > 0 && (
            <ul className="score-reasons">
              {decision.reasons.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
          <div className="text-muted text-small" style={{ marginTop: 8 }}>
            Ce score est une recommandation : la décision finale vous appartient.
          </div>
        </div>
      )}

      {mode === 'idle' && (
        <>
          <div className="flex-row" style={{ marginBottom: 10 }}>
            <Button
              variant="success"
              icon={<ThumbsUp size={16} />}
              style={{ flex: 1 }}
              onClick={() => setMode('approve')}
            >
              Accepter
            </Button>
            <Button
              variant="secondary"
              icon={<MessageSquareWarning size={16} />}
              style={{ flex: 1 }}
              onClick={() => setMode('changes')}
            >
              Demander des modifications
            </Button>
            <Button
              variant="danger"
              icon={<ThumbsDown size={16} />}
              style={{ flex: 1 }}
              onClick={() => setMode('reject')}
            >
              Refuser
            </Button>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/requests/${request._id}`)}>
              Voir la fiche complète
            </Button>
          </div>
        </>
      )}

      {mode === 'approve' && (
        <>
          <FormField label="Commentaire (optionnel)">
            <Textarea
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Commentaire transmis à l'équipe réseau et à l'employé..."
              maxLength={1000}
            />
          </FormField>
          <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setMode('idle')} disabled={submitting}>
              Retour
            </Button>
            <Button variant="success" onClick={handleApprove} loading={submitting}>
              Confirmer l'acceptation
            </Button>
          </div>
        </>
      )}

      {mode === 'changes' && (
        <>
          <FormField
            label="Modifications ou informations complémentaires attendues"
            required
            error={fieldError}
            hint="L'employé recevra ce message et pourra corriger puis re-soumettre sa demande."
          >
            <Textarea
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Ex : précisez la période exacte d'intervention et le périmètre demandé..."
              hasError={!!fieldError}
              maxLength={1000}
            />
          </FormField>
          <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setMode('idle')} disabled={submitting}>
              Retour
            </Button>
            <Button onClick={handleRequestChanges} loading={submitting}>
              Envoyer la demande de modification
            </Button>
          </div>
        </>
      )}

      {mode === 'reject' && (
        <>
          <FormField label="Motif du refus" required error={fieldError}>
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex : justification insuffisante, type d'accès trop large pour le poste..."
              hasError={!!fieldError}
              maxLength={1000}
            />
          </FormField>
          <FormField label="Commentaire complémentaire (optionnel)">
            <Textarea
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
            />
          </FormField>
          <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setMode('idle')} disabled={submitting}>
              Retour
            </Button>
            <Button variant="danger" onClick={handleReject} loading={submitting}>
              Confirmer le refus
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

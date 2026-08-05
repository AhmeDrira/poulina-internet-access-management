import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { requestsApi } from '../../api/requests.api';
import { useToast } from '../../store/ToastContext';
import { AccessRequest, DurationType, RequestType } from '../../types';
import { formatDate, toInputDate } from '../../utils/date';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import {
  ACCESS_TYPE_LABELS,
  DURATION_LABELS,
  fullName,
} from '../../utils/labels';
import { Button } from '../ui/Button';
import { FormField, Input, Select, Textarea } from '../ui/FormField';
import { Modal } from '../ui/Modal';

interface ProcessModalProps {
  request: AccessRequest | null;
  open: boolean;
  onClose: () => void;
  onProcessed: () => void;
}

/** Libellé de l'action technique positive, selon le type de formulaire */
const EXECUTE_LABELS: Record<RequestType, string> = {
  [RequestType.INTERNET_ACCESS]: "Oui — activer l'accès Internet",
  [RequestType.REMOTE_ACCESS]: "Oui — configurer l'accès à distance",
  [RequestType.EXTERNAL_DRIVE]: 'Oui — autoriser temporairement le lecteur externe',
  [RequestType.NETWORK_SHARE]: 'Oui — donner accès au partage réseau',
  [RequestType.USB_3G_KEY]: 'Oui — attribuer et activer la clé 3G',
  [RequestType.PASSWORD_COMMITMENT]: "Oui — enregistrer la fiche d'engagement",
};

function defaultExpiration(activation: string, days: number | null): string {
  if (!activation || !days) return '';
  const date = new Date(activation);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

/**
 * Modale de traitement technique par l'équipe réseau (2e vérification) :
 * exécuter la demande (avec dates) ou prononcer un refus technique motivé.
 */
export function ProcessModal({ request, open, onClose, onProcessed }: ProcessModalProps) {
  const toast = useToast();
  const { titleOf, describe } = useFormDefinitions();
  const [activated, setActivated] = useState(true);
  const [activationDate, setActivationDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<{ expiration?: string; comment?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && request) {
      const today = toInputDate(new Date());
      setActivated(true);
      setActivationDate(today);
      setExpirationDate(
        request.durationType === DurationType.TEMPORARY
          ? defaultExpiration(today, request.durationDays)
          : '',
      );
      setComment('');
      setErrors({});
    }
  }, [open, request?._id]);

  if (!request) return null;
  const isTemporary = request.durationType === DurationType.TEMPORARY;
  const { entries: specificEntries } = describe(request.requestType, request.formData);

  const handleSubmit = async () => {
    const nextErrors: { expiration?: string; comment?: string } = {};
    if (activated) {
      if (isTemporary && !expirationDate) {
        nextErrors.expiration = "La date d'expiration est obligatoire pour un accès temporaire.";
      }
      if (expirationDate && activationDate && expirationDate <= activationDate) {
        nextErrors.expiration = "La date d'expiration doit être postérieure à l'activation.";
      }
    } else if (!comment.trim()) {
      nextErrors.comment = 'Le motif technique est obligatoire en cas de refus.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await requestsApi.process(request._id, {
        accessActivated: activated,
        activationDate: activated && activationDate ? new Date(activationDate).toISOString() : undefined,
        expirationDate: activated && expirationDate ? new Date(expirationDate).toISOString() : undefined,
        networkComment: comment.trim() || undefined,
      });
      toast.success(
        activated
          ? "Demande exécutée. L'employé a été notifié."
          : "Refus technique enregistré. L'employé a été notifié.",
      );
      onProcessed();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Traiter la demande ${request.reference}`}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Enregistrer le traitement
          </Button>
        </>
      }
    >
      <div className="detail-grid" style={{ marginBottom: 14 }}>
        <div>
          <div className="detail-item-label">Type de formulaire</div>
          <div className="detail-item-value">{titleOf(request.requestType)}</div>
        </div>
        <div>
          <div className="detail-item-label">Demandeur</div>
          <div className="detail-item-value">
            {request.firstName} {request.lastName}
          </div>
        </div>
        <div>
          <div className="detail-item-label">Département</div>
          <div className="detail-item-value">{request.department?.name ?? '—'}</div>
        </div>
        {request.accessType && (
          <div>
            <div className="detail-item-label">Type d'accès</div>
            <div className="detail-item-value">{ACCESS_TYPE_LABELS[request.accessType]}</div>
          </div>
        )}
        <div>
          <div className="detail-item-label">Durée demandée</div>
          <div className="detail-item-value">
            {request.durationDays
              ? `${DURATION_LABELS[request.durationType]} — ${request.durationDays} jours`
              : DURATION_LABELS[request.durationType]}
          </div>
        </div>
        <div>
          <div className="detail-item-label">Acceptée par</div>
          <div className="detail-item-value">
            {fullName(request.managerDecisionBy)} le {formatDate(request.managerDecisionAt)}
          </div>
        </div>
        {specificEntries.map((entry) => (
          <div key={entry.label}>
            <div className="detail-item-label">{entry.label}</div>
            <div className="detail-item-value">{entry.value}</div>
          </div>
        ))}
      </div>

      {request.managerComment && (
        <>
          <div className="detail-item-label">Commentaire du chef</div>
          <div className="justification-block" style={{ marginBottom: 14 }}>
            {request.managerComment}
          </div>
        </>
      )}

      <FormField label="Résultat de la vérification technique" required>
        <Select
          value={activated ? 'yes' : 'no'}
          onChange={(event) => setActivated(event.target.value === 'yes')}
        >
          <option value="yes">{EXECUTE_LABELS[request.requestType]}</option>
          <option value="no">Non — refus technique (motif obligatoire)</option>
        </Select>
      </FormField>

      {activated && (
        <div className="form-grid">
          <FormField label="Date d'activation / d'exécution" required>
            <Input
              type="date"
              value={activationDate}
              onChange={(event) => {
                setActivationDate(event.target.value);
                if (isTemporary) {
                  setExpirationDate(defaultExpiration(event.target.value, request.durationDays));
                }
              }}
            />
          </FormField>
          <FormField
            label="Date d'expiration"
            required={isTemporary}
            error={errors.expiration}
            hint={isTemporary ? undefined : 'Laisser vide pour une validité permanente.'}
          >
            <Input
              type="date"
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
              hasError={!!errors.expiration}
            />
          </FormField>
        </div>
      )}

      <FormField
        label={activated ? 'Commentaire technique (optionnel)' : 'Motif du refus technique'}
        required={!activated}
        error={errors.comment}
      >
        <Textarea
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Ex : profil proxy appliqué, VPN configuré, règle firewall, motif du refus technique..."
          hasError={!!errors.comment}
          maxLength={1000}
        />
      </FormField>
    </Modal>
  );
}

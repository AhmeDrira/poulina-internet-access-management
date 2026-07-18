import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileDown, FileSearch, Pencil } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { requestsApi } from '../../api/requests.api';
import { ScoreBadge, StatusBadge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingBlock } from '../../components/ui/Spinner';
import { RequestTimeline } from '../../components/requests/RequestTimeline';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { RecommendationLevel, RequestStatus, Role } from '../../types';
import { formatDate, formatDateTime } from '../../utils/date';
import { FORM_FIELDS, formatFormValue } from '../../utils/formDefinitions';
import { useToast } from '../../store/ToastContext';
import {
  ACCESS_TYPE_LABELS,
  DURATION_LABELS,
  fullName,
  RECOMMENDATION_LABELS,
  REQUEST_TYPE_FULL_LABELS,
} from '../../utils/labels';

const SCORE_BAR_COLORS: Record<RecommendationLevel, string> = {
  [RecommendationLevel.LIKELY_LEGITIMATE]: 'var(--green-600)',
  [RecommendationLevel.NEEDS_REVIEW]: 'var(--amber-700)',
  [RecommendationLevel.RISKY]: 'var(--red-600)',
};

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="detail-item-label">{label}</div>
      <div className="detail-item-value">{value}</div>
    </div>
  );
}

export default function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const { data: request, loading, error } = useApi(() => requestsApi.get(id!), [id]);
  const { data: history, loading: historyLoading } = useApi(
    () => requestsApi.history(id!),
    [id],
  );

  const handleDownloadPdf = async () => {
    if (!request) return;
    setDownloading(true);
    try {
      await requestsApi.downloadPdf(request._id, request.reference);
    } catch (downloadError) {
      toast.error(getApiErrorMessage(downloadError));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingBlock />;
  }

  if (error || !request) {
    return (
      <div className="full-page-loader">
        <EmptyState
          icon={<FileSearch size={26} />}
          title="Demande introuvable ou accès refusé"
          message={error ?? undefined}
          action={
            <Button variant="secondary" onClick={() => navigate('/')}>
              Retour au tableau de bord
            </Button>
          }
        />
      </div>
    );
  }

  const canSeeScore = hasRole(Role.MANAGER, Role.ADMIN, Role.SECURITY_OFFICER);
  const decision = request.decisionSupport;
  const hasNetworkInfo =
    request.processedBy || request.networkComment || request.activationDate;
  const isOwner = user?._id === request.requester?._id;
  const specificEntries = FORM_FIELDS[request.requestType]
    .filter((field) => request.formData && request.formData[field.key] !== undefined)
    .map((field) => ({
      label: field.label,
      value: formatFormValue(request.requestType, field.key, request.formData[field.key]),
    }));

  return (
    <>
      <PageHeader
        title={`Demande ${request.reference}`}
        subtitle={`${REQUEST_TYPE_FULL_LABELS[request.requestType]} — créée le ${formatDateTime(request.createdAt)}`}
        actions={
          <div className="flex-row" style={{ alignItems: 'center' }}>
            <StatusBadge status={request.status} />
            <Button
              variant="secondary"
              size="sm"
              icon={<FileDown size={15} />}
              loading={downloading}
              onClick={handleDownloadPdf}
            >
              Exporter en PDF
            </Button>
          </div>
        }
      />

      {request.status === RequestStatus.CHANGES_REQUESTED && isOwner && (
        <Alert variant="warning">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              <strong>Le chef de département demande des modifications :</strong>{' '}
              {request.managerComment}
            </span>
            <Button
              size="sm"
              icon={<Pencil size={14} />}
              onClick={() => navigate(`/requests/${request._id}/edit`)}
            >
              Modifier et re-soumettre
            </Button>
          </div>
        </Alert>
      )}

      {request.status === RequestStatus.REJECTED_TECHNICAL && (
        <Alert variant="danger">
          <strong>Refus technique de l'équipe réseau</strong>
          {request.processedBy && ` par ${fullName(request.processedBy)}`}
          {request.processedAt && ` le ${formatDate(request.processedAt)}`}. Motif :{' '}
          {request.networkComment || '—'}
        </Alert>
      )}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Informations de la demande">
            <div className="detail-grid" style={{ marginBottom: 18 }}>
              <DetailItem label="Type de formulaire" value={REQUEST_TYPE_FULL_LABELS[request.requestType]} />
              <DetailItem label="Demandeur" value={`${request.firstName} ${request.lastName}`} />
              <DetailItem label="Matricule" value={<span className="font-mono">{request.matricule}</span>} />
              <DetailItem label="Email" value={request.email} />
              <DetailItem label="Département" value={request.department?.name ?? '—'} />
              <DetailItem label="Service" value={request.service?.name ?? '—'} />
              <DetailItem label="Poste" value={request.position || '—'} />
              {request.accessType && (
                <DetailItem label="Type d'accès" value={ACCESS_TYPE_LABELS[request.accessType]} />
              )}
              <DetailItem
                label="Durée"
                value={
                  request.durationDays
                    ? `${DURATION_LABELS[request.durationType]} — ${request.durationDays} jours`
                    : DURATION_LABELS[request.durationType]
                }
              />
              <DetailItem label="Date de création" value={formatDate(request.createdAt)} />
              {specificEntries.map((entry) => (
                <DetailItem key={entry.label} label={entry.label} value={entry.value} />
              ))}
            </div>
            <div className="detail-item-label">Justification</div>
            <div className="justification-block">{request.justification}</div>
          </Card>

          {request.status === 'REJECTED' && request.rejectionReason && (
            <Alert variant="danger">
              <strong>Demande refusée</strong>
              {request.managerDecisionBy &&
                ` par ${fullName(request.managerDecisionBy)} le ${formatDate(request.managerDecisionAt)}`}
              . Motif : {request.rejectionReason}
            </Alert>
          )}

          {request.managerComment &&
            request.status !== RequestStatus.REJECTED &&
            request.status !== RequestStatus.CHANGES_REQUESTED && (
            <Card title="Décision du chef de département">
              <div className="justification-block" style={{ marginBottom: 10 }}>
                {request.managerComment}
              </div>
              <div className="text-muted text-small">
                Par {fullName(request.managerDecisionBy)} le {formatDateTime(request.managerDecisionAt)}
              </div>
            </Card>
          )}

          {hasNetworkInfo && (
            <Card title="Traitement réseau">
              <div className="detail-grid" style={{ marginBottom: request.networkComment ? 16 : 0 }}>
                <DetailItem label="Traité par" value={fullName(request.processedBy)} />
                <DetailItem label="Le" value={formatDateTime(request.processedAt)} />
                <DetailItem
                  label="Accès activé"
                  value={
                    request.accessActivated === null ? '—' : request.accessActivated ? 'Oui' : 'Non'
                  }
                />
                <DetailItem label="Date d'activation" value={formatDate(request.activationDate)} />
                <DetailItem
                  label="Date d'expiration"
                  value={request.expirationDate ? formatDate(request.expirationDate) : 'Permanent'}
                />
              </div>
              {request.networkComment && (
                <>
                  <div className="detail-item-label">Commentaire technique</div>
                  <div className="justification-block">{request.networkComment}</div>
                </>
              )}
            </Card>
          )}

          {canSeeScore && decision && (
            <Card title="Aide à la décision">
              <div className="score-panel">
                <div className="score-panel-header">
                  <span className="score-value">{decision.score}/100</span>
                  <ScoreBadge decision={decision} />
                </div>
                <div className="score-bar">
                  <div
                    className="score-bar-fill"
                    style={{
                      width: `${decision.score}%`,
                      background: SCORE_BAR_COLORS[decision.level],
                    }}
                  />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {RECOMMENDATION_LABELS[decision.level]}
                </div>
                {decision.reasons.length > 0 && (
                  <ul className="score-reasons">
                    {decision.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                )}
                <div className="text-muted text-small" style={{ marginTop: 10 }}>
                  Recommandation indicative — la décision reste humaine.
                </div>
              </div>
            </Card>
          )}
        </div>

        <Card title="Historique de la demande">
          {historyLoading ? (
            <LoadingBlock />
          ) : (
            <RequestTimeline entries={history ?? []} />
          )}
        </Card>
      </div>
    </>
  );
}

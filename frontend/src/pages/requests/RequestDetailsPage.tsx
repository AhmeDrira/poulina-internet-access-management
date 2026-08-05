import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileDown, FileSearch, MessagesSquare, Pencil } from 'lucide-react';
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
import { RequestThreadPanel } from '../../components/messaging/RequestThreadPanel';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import {
  GLOBAL_READ_ROLES,
  MESSAGING_ROLES,
  RecommendationLevel,
  RequestStatus,
  Role,
} from '../../types';
import { formatDate, formatDateTime } from '../../utils/date';
import { useToast } from '../../store/ToastContext';
import {
  ACCESS_TYPE_LABELS,
  DURATION_LABELS,
  fullName,
  RECOMMENDATION_LABELS,
} from '../../utils/labels';

/** Statuts à partir desquels le chef de département et l'équipe réseau échangent */
const THREAD_STATUSES: RequestStatus[] = [
  RequestStatus.APPROVED_BY_MANAGER,
  RequestStatus.PENDING_NETWORK,
  RequestStatus.IN_PROGRESS_NETWORK,
  RequestStatus.ACTIVATED,
  RequestStatus.REJECTED_TECHNICAL,
  RequestStatus.CLOSED,
  RequestStatus.EXPIRED,
];

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
  const { titleOf, describe } = useFormDefinitions();
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

  const canSeeScore = hasRole(Role.MANAGER, ...GLOBAL_READ_ROLES);
  const decision = request.decisionSupport;
  const hasNetworkInfo =
    request.processedBy || request.networkComment || request.activationDate;
  const isOwner = user?._id === request.requester?._id;
  const { entries: specificEntries, commitments } = describe(
    request.requestType,
    request.formData,
  );
  // Discussion interne : chef du département concerné et équipe réseau, à
  // partir de la validation du chef, et jamais sur sa propre demande.
  const canDiscuss =
    !!user &&
    MESSAGING_ROLES.includes(user.role) &&
    !isOwner &&
    THREAD_STATUSES.includes(request.status) &&
    (user.role !== Role.MANAGER || user.department?._id === request.department?._id);

  return (
    <>
      <PageHeader
        title={`Demande ${request.reference}`}
        subtitle={`${titleOf(request.requestType)} — créée le ${formatDateTime(request.createdAt)}`}
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
              <DetailItem label="Type de formulaire" value={titleOf(request.requestType)} />
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
            {commitments.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div className="detail-item-label">Engagements</div>
                {commitments.map((commitment) => (
                  <div
                    key={commitment.label}
                    className="text-small"
                    style={{ display: 'flex', gap: 8, marginTop: 6, lineHeight: 1.5 }}
                  >
                    <span
                      style={{
                        color: commitment.accepted ? 'var(--green-600)' : 'var(--red-600)',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {commitment.accepted ? '☑' : '☐'}
                    </span>
                    <span>{commitment.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="detail-item-label">Justification</div>
            <div className="justification-block">{request.justification}</div>
          </Card>

          {canDiscuss && (
            <Card
              title={
                <span className="flex-row" style={{ gap: 8, alignItems: 'center' }}>
                  <MessagesSquare size={16} /> Discussion interne
                </span>
              }
              subtitle={
                user?.role === Role.MANAGER
                  ? 'Échange avec l’équipe réseau sur le traitement de cette demande'
                  : 'Échange avec le chef de département sur le traitement de cette demande'
              }
            >
              <RequestThreadPanel requestId={request._id} />
            </Card>
          )}

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

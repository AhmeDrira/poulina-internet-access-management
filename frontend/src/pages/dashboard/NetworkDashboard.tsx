import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, TimerOff, Wifi, Wrench } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { requestsApi } from '../../api/requests.api';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormField';
import { ConfirmDialog } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { ProcessModal } from '../../components/network/ProcessModal';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../store/ToastContext';
import { AccessRequest, RequestStatus, RequestType } from '../../types';
import { formatDate } from '../../utils/date';
import {
  DURATION_LABELS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_OPTIONS,
  STATUS_LABELS,
} from '../../utils/labels';

const QUEUE_STATUSES: RequestStatus[] = [
  RequestStatus.APPROVED_BY_MANAGER,
  RequestStatus.PENDING_NETWORK,
  RequestStatus.IN_PROGRESS_NETWORK,
  RequestStatus.ACTIVATED,
  RequestStatus.REJECTED_TECHNICAL,
  RequestStatus.CLOSED,
  RequestStatus.EXPIRED,
];

export default function NetworkDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [requestType, setRequestType] = useState<RequestType | ''>('');
  const [search, setSearch] = useState('');
  const [toProcess, setToProcess] = useState<AccessRequest | null>(null);
  const [toTake, setToTake] = useState<AccessRequest | null>(null);
  const [toClose, setToClose] = useState<AccessRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const debouncedSearch = useDebounce(search);

  const stats = useApi(() => requestsApi.list({ limit: 100 }), []);
  const list = useApi(
    () => requestsApi.list({ page, limit: 10, status, requestType, search: debouncedSearch }),
    [page, status, requestType, debouncedSearch],
  );

  const reloadAll = () => {
    list.reload();
    stats.reload();
  };

  const allRequests = stats.data?.data ?? [];
  const count = (...statuses: RequestStatus[]) =>
    allRequests.filter((request) => statuses.includes(request.status)).length;

  const handleTakeInCharge = async () => {
    if (!toTake) return;
    setActionLoading(true);
    try {
      await requestsApi.startProcessing(toTake._id);
      toast.success(`Demande ${toTake.reference} prise en charge.`);
      setToTake(null);
      reloadAll();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!toClose) return;
    setActionLoading(true);
    try {
      await requestsApi.close(toClose._id);
      toast.success(`Demande ${toClose.reference} clôturée.`);
      setToClose(null);
      reloadAll();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const renderAction = (row: AccessRequest) => {
    switch (row.status) {
      case RequestStatus.APPROVED_BY_MANAGER:
      case RequestStatus.PENDING_NETWORK:
        return (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setToTake(row);
            }}
          >
            Prendre en charge
          </Button>
        );
      case RequestStatus.IN_PROGRESS_NETWORK:
        return (
          <Button
            size="sm"
            variant="success"
            onClick={(event) => {
              event.stopPropagation();
              setToProcess(row);
            }}
          >
            Traiter
          </Button>
        );
      case RequestStatus.ACTIVATED:
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              setToClose(row);
            }}
          >
            Clôturer
          </Button>
        );
      default:
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/requests/${row._id}`);
            }}
          >
            Détails
          </Button>
        );
    }
  };

  const columns: Column<AccessRequest>[] = [
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => <span className="font-mono">{row.reference}</span>,
    },
    {
      key: 'requester',
      header: 'Demandeur',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.firstName} {row.lastName}
          </div>
          <div className="text-small text-muted">{row.matricule}</div>
        </div>
      ),
    },
    { key: 'department', header: 'Département', render: (row) => row.department?.name ?? '—' },
    {
      key: 'type',
      header: 'Formulaire',
      render: (row) => (
        <Badge color={REQUEST_TYPE_COLORS[row.requestType]}>
          {REQUEST_TYPE_LABELS[row.requestType]}
        </Badge>
      ),
    },
    {
      key: 'duration',
      header: 'Durée',
      render: (row) =>
        row.durationDays
          ? `${DURATION_LABELS[row.durationType]} — ${row.durationDays} j`
          : DURATION_LABELS[row.durationType],
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'approvedAt',
      header: 'Acceptée le',
      render: (row) => formatDate(row.managerDecisionAt),
    },
    { key: 'actions', header: 'Actions', render: renderAction },
  ];

  return (
    <>
      <PageHeader title="Traitement des demandes" subtitle="Équipe réseau et serveur" />

      <div className="stats-grid">
        <StatCard
          label="À prendre en charge"
          value={
            stats.loading
              ? '…'
              : count(RequestStatus.APPROVED_BY_MANAGER, RequestStatus.PENDING_NETWORK)
          }
          icon={<Inbox size={21} />}
          accent="amber"
        />
        <StatCard
          label="En cours de traitement"
          value={stats.loading ? '…' : count(RequestStatus.IN_PROGRESS_NETWORK)}
          icon={<Wrench size={21} />}
          accent="purple"
        />
        <StatCard
          label="Accès actifs"
          value={stats.loading ? '…' : count(RequestStatus.ACTIVATED)}
          icon={<Wifi size={21} />}
          accent="green"
        />
        <StatCard
          label="Expirés"
          value={stats.loading ? '…' : count(RequestStatus.EXPIRED)}
          icon={<TimerOff size={21} />}
          accent="orange"
        />
      </div>

      <Card noPadding>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Référence, nom, matricule..."
          />
          <Select
            value={requestType}
            onChange={(event) => {
              setRequestType(event.target.value as RequestType | '');
              setPage(1);
            }}
            style={{ maxWidth: 200 }}
          >
            <option value="">Tous les formulaires</option>
            {REQUEST_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RequestStatus | '');
              setPage(1);
            }}
            style={{ maxWidth: 240 }}
          >
            <option value="">Toute la file réseau</option>
            {QUEUE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          rowKey={(row) => row._id}
          loading={list.loading}
          emptyTitle="Aucune demande à traiter"
          emptyMessage="Les demandes validées par les chefs de département apparaîtront ici."
          onRowClick={(row) => navigate(`/requests/${row._id}`)}
        />
        {list.data && (
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            total={list.data.total}
            onChange={setPage}
          />
        )}
      </Card>

      <ProcessModal
        request={toProcess}
        open={toProcess !== null}
        onClose={() => setToProcess(null)}
        onProcessed={reloadAll}
      />
      <ConfirmDialog
        open={toTake !== null}
        title="Prendre en charge"
        message={`Prendre en charge la demande ${toTake?.reference ?? ''} ? Son statut passera à « En cours de traitement » et l'employé sera notifié.`}
        confirmLabel="Prendre en charge"
        loading={actionLoading}
        onConfirm={handleTakeInCharge}
        onCancel={() => setToTake(null)}
      />
      <ConfirmDialog
        open={toClose !== null}
        title="Clôturer la demande"
        message={`Clôturer la demande ${toClose?.reference ?? ''} ? L'accès sera considéré comme terminé.`}
        confirmLabel="Clôturer"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleClose}
        onCancel={() => setToClose(null)}
      />
    </>
  );
}

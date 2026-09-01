import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Percent, ThumbsDown, ThumbsUp } from 'lucide-react';
import { requestsApi } from '../../api/requests.api';
import { statisticsApi } from '../../api/statistics.api';
import { Badge, ScoreBadge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { DecisionModal } from '../../components/manager/DecisionModal';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../store/AuthContext';
import { AccessRequest, RequestStatus, RequestType } from '../../types';
import { formatDate } from '../../utils/date';
import {
  DURATION_LABELS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '../../utils/labels';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RequestStatus | ''>(RequestStatus.PENDING_MANAGER);
  const [requestType, setRequestType] = useState<RequestType | ''>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<AccessRequest | null>(null);

  const debouncedSearch = useDebounce(search);

  const stats = useApi(() => statisticsApi.overview(), []);
  const list = useApi(
    () =>
      requestsApi.list({
        page,
        limit: 10,
        status,
        requestType,
        search: debouncedSearch,
        dateFrom,
        dateTo,
      }),
    [page, status, requestType, debouncedSearch, dateFrom, dateTo],
  );

  const reloadAll = () => {
    list.reload();
    stats.reload();
  };

  const resetPage = () => setPage(1);

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
    {
      key: 'score',
      header: 'Aide à la décision',
      render: (row) => (row.decisionSupport ? <ScoreBadge decision={row.decisionSupport} /> : '—'),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Créée le', render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) =>
        row.status === RequestStatus.PENDING_MANAGER ? (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setSelected(row);
            }}
          >
            Examiner
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/requests/${row._id}`);
            }}
          >
            Détails
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Validation des demandes"
        subtitle={`Département ${user?.department?.name ?? ''}`}
      />

      <div className="stats-grid">
        <StatCard
          label="À valider"
          value={stats.loading ? '…' : stats.data?.pendingManager ?? 0}
          icon={<Clock size={21} />}
          accent="amber"
        />
        <StatCard
          label="Acceptées (en traitement)"
          value={stats.loading ? '…' : stats.data?.approvedByManager ?? 0}
          icon={<ThumbsUp size={21} />}
          accent="blue"
        />
        <StatCard
          label="Refusées"
          value={stats.loading ? '…' : stats.data?.rejected ?? 0}
          icon={<ThumbsDown size={21} />}
          accent="red"
        />
        <StatCard
          label="Taux d'acceptation"
          value={stats.loading ? '…' : `${stats.data?.acceptanceRate ?? 0}%`}
          icon={<Percent size={21} />}
          accent="green"
          hint={
            stats.data ? `Délai moyen de validation : ${stats.data.avgManagerDecisionHours} h` : undefined
          }
        />
      </div>

      <Card noPadding>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="Référence, nom, matricule..."
          />
          <Select
            value={requestType}
            onChange={(event) => {
              setRequestType(event.target.value as RequestType | '');
              resetPage();
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
              resetPage();
            }}
            style={{ maxWidth: 220 }}
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              resetPage();
            }}
            title="Créées à partir du"
            style={{ maxWidth: 160 }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              resetPage();
            }}
            title="Créées jusqu'au"
            style={{ maxWidth: 160 }}
          />
        </div>
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          rowKey={(row) => row._id}
          loading={list.loading}
          emptyTitle="Aucune demande en attente"
          emptyMessage="Aucune demande de vos collaborateurs ne correspond à ces filtres."
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

      <DecisionModal
        request={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onDecided={reloadAll}
      />
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { requestsApi } from '../../api/requests.api';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/FormField';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { AccessRequest, RequestStatus, RequestType, Role } from '../../types';
import { formatDate } from '../../utils/date';
import {
  DURATION_LABELS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '../../utils/labels';

export default function MyRequestsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [requestType, setRequestType] = useState<RequestType | ''>('');

  const { data, loading } = useApi(
    () => requestsApi.my({ page, limit: 10, status, requestType }),
    [page, status, requestType],
  );

  const columns: Column<AccessRequest>[] = [
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => <span className="font-mono">{row.reference}</span>,
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
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Créée le', render: (row) => formatDate(row.createdAt) },
    { key: 'updatedAt', header: 'Dernière mise à jour', render: (row) => formatDate(row.updatedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Mes demandes"
        subtitle="Historique de toutes vos demandes d'accès Internet"
        actions={
          hasRole(Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM) ? (
            <Button icon={<Plus size={16} />} onClick={() => navigate('/requests/new')}>
              Nouvelle demande
            </Button>
          ) : undefined
        }
      />
      <Card noPadding>
        <div className="table-toolbar">
          <Select
            value={requestType}
            onChange={(event) => {
              setRequestType(event.target.value as RequestType | '');
              setPage(1);
            }}
            style={{ maxWidth: 220 }}
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
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          rowKey={(row) => row._id}
          loading={loading}
          emptyTitle="Aucune demande trouvée"
          emptyMessage="Aucune demande ne correspond à ce filtre."
          onRowClick={(row) => navigate(`/requests/${row._id}`)}
        />
        {data && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onChange={setPage}
          />
        )}
      </Card>
    </>
  );
}

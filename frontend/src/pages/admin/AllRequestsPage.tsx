import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { departmentsApi } from '../../api/departments.api';
import { requestsApi } from '../../api/requests.api';
import { Badge, ScoreBadge, StatusBadge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { AccessRequest, RequestStatus, RequestType } from '../../types';
import { formatDate } from '../../utils/date';
import {
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '../../utils/labels';

export default function AllRequestsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [requestType, setRequestType] = useState<RequestType | ''>('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const debouncedSearch = useDebounce(search);
  const departments = useApi(() => departmentsApi.list(), []);
  const list = useApi(
    () =>
      requestsApi.list({
        page,
        limit: 10,
        status,
        requestType,
        department,
        search: debouncedSearch,
        dateFrom,
        dateTo,
      }),
    [page, status, requestType, department, debouncedSearch, dateFrom, dateTo],
  );

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
      key: 'score',
      header: 'Score',
      render: (row) => (row.decisionSupport ? <ScoreBadge decision={row.decisionSupport} /> : '—'),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Créée le', render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Toutes les demandes"
        subtitle="Vision globale — administration et supervision sécurité"
      />
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
            onChange={(e) => {
              setRequestType(e.target.value as RequestType | '');
              setPage(1);
            }}
            style={{ maxWidth: 195 }}
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
            onChange={(e) => {
              setStatus(e.target.value as RequestStatus | '');
              setPage(1);
            }}
            style={{ maxWidth: 210 }}
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 210 }}
          >
            <option value="">Tous les départements</option>
            {(departments.data ?? []).map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            title="Créées à partir du"
            style={{ maxWidth: 155 }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            title="Créées jusqu'au"
            style={{ maxWidth: 155 }}
          />
        </div>
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          rowKey={(row) => row._id}
          loading={list.loading}
          emptyTitle="Aucune demande trouvée"
          emptyMessage="Aucune demande ne correspond à ces filtres."
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
    </>
  );
}

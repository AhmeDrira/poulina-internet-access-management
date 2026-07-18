import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { auditLogsApi } from '../../api/auditLogs.api';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { AuditLog } from '../../types';
import { formatDateTime } from '../../utils/date';
import { AUDIT_ACTION_LABELS, BadgeColor } from '../../utils/labels';

function actionColor(action: string): BadgeColor {
  if (['LOGIN_FAILED', 'USER_DELETED', 'REQUEST_REJECTED'].includes(action)) return 'red';
  if (['LOGIN_SUCCESS', 'REQUEST_APPROVED', 'REQUEST_PROCESSED'].includes(action)) return 'green';
  if (action.startsWith('USER_') || action === 'ROLE_CHANGED' || action === 'PASSWORD_CHANGED') return 'purple';
  if (action.startsWith('REQUEST_')) return 'blue';
  if (action.startsWith('DEPARTMENT_') || action.startsWith('SERVICE_')) return 'cyan';
  return 'slate';
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const debouncedSearch = useDebounce(search);
  const list = useApi(
    () =>
      auditLogsApi.list({
        page,
        limit: 15,
        action,
        search: debouncedSearch,
        dateFrom,
        dateTo,
      }),
    [page, action, debouncedSearch, dateFrom, dateTo],
  );

  const columns: Column<AuditLog>[] = [
    { key: 'createdAt', header: 'Date', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'user',
      header: 'Utilisateur',
      render: (row) =>
        row.user ? (
          <div>
            <div style={{ fontWeight: 600 }}>
              {row.user.firstName} {row.user.lastName}
            </div>
            <div className="text-small text-muted">{row.user.email}</div>
          </div>
        ) : (
          <span className="text-muted">{row.userEmail || 'Système'}</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge color={actionColor(row.action)}>{AUDIT_ACTION_LABELS[row.action] ?? row.action}</Badge>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Adresse IP',
      render: (row) => <span className="font-mono">{row.ipAddress || '—'}</span>,
    },
    {
      key: 'details',
      header: 'Détails',
      render: (row) => {
        const text = row.details && Object.keys(row.details).length > 0 ? JSON.stringify(row.details) : '';
        if (!text) return '—';
        return (
          <span className="font-mono text-small" title={text}>
            {text.length > 60 ? `${text.slice(0, 60)}…` : text}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité des connexions et des actions sensibles (avec adresse IP)"
      />
      <Card noPadding>
        <div className="table-toolbar">
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 240 }}
          >
            <option value="">Toutes les actions</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Email utilisateur..."
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            title="À partir du"
            style={{ maxWidth: 155 }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            title="Jusqu'au"
            style={{ maxWidth: 155 }}
          />
        </div>
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          rowKey={(row) => row._id}
          loading={list.loading}
          emptyIcon={<ScrollText size={26} />}
          emptyTitle="Aucune entrée d'audit"
          emptyMessage="Les actions importantes (connexions, validations, modifications) apparaîtront ici."
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

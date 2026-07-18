import { useNavigate } from 'react-router-dom';
import { Clock, FilePlus2, FileText, Plus, Wifi, XCircle } from 'lucide-react';
import { requestsApi } from '../../api/requests.api';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Column, DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { AccessRequest, RequestStatus } from '../../types';
import { formatDate } from '../../utils/date';
import {
  DURATION_LABELS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
} from '../../utils/labels';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading } = useApi(() => requestsApi.my({ limit: 100 }), []);

  const requests = data?.data ?? [];
  const count = (status: RequestStatus) =>
    requests.filter((request) => request.status === status).length;

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const expiringSoon = requests.filter(
    (request) =>
      request.status === RequestStatus.ACTIVATED &&
      request.expirationDate &&
      new Date(request.expirationDate) <= in7Days,
  );

  const columns: Column<AccessRequest>[] = [
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => <span className="font-mono">{row.reference}</span>,
    },
    {
      key: 'requestType',
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
  ];

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.firstName ?? ''}`}
        subtitle="Suivez vos demandes d'accès Internet"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => navigate('/requests/new')}>
            Nouvelle demande
          </Button>
        }
      />

      {requests
        .filter((request) => request.status === RequestStatus.CHANGES_REQUESTED)
        .map((request) => (
          <Alert key={request._id} variant="warning">
            Le chef de département demande des <strong>modifications</strong> sur votre demande{' '}
            <strong>{request.reference}</strong>.{' '}
            <a
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate(`/requests/${request._id}`)}
            >
              Corriger et re-soumettre
            </a>
          </Alert>
        ))}

      {expiringSoon.map((request) => (
        <Alert key={request._id} variant="warning">
          Votre accès <strong>{request.reference}</strong> expire le{' '}
          <strong>{formatDate(request.expirationDate)}</strong>. Pensez à demander un
          renouvellement.
        </Alert>
      ))}

      <div className="stats-grid">
        <StatCard
          label="Demandes totales"
          value={loading ? '…' : requests.length}
          icon={<FileText size={21} />}
          accent="blue"
        />
        <StatCard
          label="En attente de validation"
          value={loading ? '…' : count(RequestStatus.PENDING_MANAGER)}
          icon={<Clock size={21} />}
          accent="amber"
        />
        <StatCard
          label="Accès actifs"
          value={loading ? '…' : count(RequestStatus.ACTIVATED)}
          icon={<Wifi size={21} />}
          accent="green"
        />
        <StatCard
          label="Refusées"
          value={loading ? '…' : count(RequestStatus.REJECTED)}
          icon={<XCircle size={21} />}
          accent="red"
        />
      </div>

      <Card
        title="Mes dernières demandes"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/my-requests')}>
            Voir toutes mes demandes
          </Button>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={requests.slice(0, 5)}
          rowKey={(row) => row._id}
          loading={loading}
          emptyIcon={<FilePlus2 size={26} />}
          emptyTitle="Aucune demande pour le moment"
          emptyMessage="Créez votre première demande d'accès Internet : elle sera transmise à votre chef de département."
          onRowClick={(row) => navigate(`/requests/${row._id}`)}
        />
      </Card>
    </>
  );
}

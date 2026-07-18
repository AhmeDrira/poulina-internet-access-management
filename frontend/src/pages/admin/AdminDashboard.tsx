import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, Clock, FileText, Percent, Server, XCircle } from 'lucide-react';
import { requestsApi } from '../../api/requests.api';
import { statisticsApi } from '../../api/statistics.api';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useApi } from '../../hooks/useApi';
import { AccessRequest, RequestStatus } from '../../types';
import { formatDate } from '../../utils/date';
import { REQUEST_TYPE_LABELS, STATUS_LABELS } from '../../utils/labels';

// Palette validée (contraste + séparation CVD) — cohérente avec les badges de statut
const COLORS = {
  pending: '#b45309',
  approved: '#1d4ed8',
  rejected: '#dc2626',
  activated: '#16803c',
  created: '#1d54a7',
};

const STATUS_HEX: Record<RequestStatus, string> = {
  [RequestStatus.PENDING_MANAGER]: '#b45309',
  [RequestStatus.CHANGES_REQUESTED]: '#a16207',
  [RequestStatus.REJECTED]: '#dc2626',
  [RequestStatus.APPROVED_BY_MANAGER]: '#1d4ed8',
  [RequestStatus.PENDING_NETWORK]: '#0e7490',
  [RequestStatus.IN_PROGRESS_NETWORK]: '#7c3aed',
  [RequestStatus.ACTIVATED]: '#16803c',
  [RequestStatus.REJECTED_TECHNICAL]: '#be123c',
  [RequestStatus.CLOSED]: '#64748b',
  [RequestStatus.EXPIRED]: '#c2410c',
};

const AXIS_PROPS = {
  tick: { fontSize: 12, fill: '#64748b' },
  axisLine: false as const,
  tickLine: false as const,
};

export default function AdminDashboard({ readOnly = false }: { readOnly?: boolean }) {
  const navigate = useNavigate();
  const overview = useApi(() => statisticsApi.overview(), []);
  const byDepartment = useApi(() => statisticsApi.byDepartment(), []);
  const byType = useApi(() => statisticsApi.byType(), []);
  const monthly = useApi(() => statisticsApi.monthly(6), []);
  const recent = useApi(() => requestsApi.list({ limit: 5 }), []);

  const stats = overview.data;

  const statusData = stats
    ? Object.entries(stats.byStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          status: status as RequestStatus,
          label: STATUS_LABELS[status as RequestStatus],
          count,
        }))
    : [];

  const typeData = (byType.data ?? []).map((row) => ({
    ...row,
    label: REQUEST_TYPE_LABELS[row.requestType],
  }));

  const recentColumns: Column<AccessRequest>[] = [
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => <span className="font-mono">{row.reference}</span>,
    },
    {
      key: 'type',
      header: 'Formulaire',
      render: (row) => REQUEST_TYPE_LABELS[row.requestType],
    },
    {
      key: 'requester',
      header: 'Demandeur',
      render: (row) => `${row.firstName} ${row.lastName}`,
    },
    { key: 'department', header: 'Département', render: (row) => row.department?.name ?? '—' },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Créée le', render: (row) => formatDate(row.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title={readOnly ? 'Supervision sécurité' : 'Tableau de bord administrateur'}
        subtitle="Vue globale des demandes d'accès Internet"
      />

      <div className="stats-grid">
        <StatCard
          label="Demandes totales"
          value={overview.loading ? '…' : stats?.total ?? 0}
          icon={<FileText size={21} />}
          accent="blue"
        />
        <StatCard
          label="En attente du chef"
          value={overview.loading ? '…' : stats?.pendingManager ?? 0}
          icon={<Clock size={21} />}
          accent="amber"
        />
        <StatCard
          label="Chez l'équipe réseau"
          value={overview.loading ? '…' : stats?.approvedByManager ?? 0}
          icon={<Server size={21} />}
          accent="purple"
        />
        <StatCard
          label="Refusées"
          value={overview.loading ? '…' : stats?.rejected ?? 0}
          icon={<XCircle size={21} />}
          accent="red"
        />
        <StatCard
          label="Traitées"
          value={overview.loading ? '…' : stats?.processed ?? 0}
          icon={<CheckCircle2 size={21} />}
          accent="green"
          hint={stats ? `Délai moyen de traitement : ${stats.avgProcessingHours} h` : undefined}
        />
        <StatCard
          label="Taux d'acceptation"
          value={overview.loading ? '…' : `${stats?.acceptanceRate ?? 0}%`}
          icon={<Percent size={21} />}
          accent="cyan"
          hint={stats ? `Délai moyen de validation : ${stats.avgManagerDecisionHours} h` : undefined}
        />
      </div>

      <div className="charts-grid" style={{ marginBottom: 20 }}>
        <Card title="Demandes par département" subtitle="Répartition par état du workflow">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDepartment.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="departmentName" {...AXIS_PROPS} />
              <YAxis allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pending" name="En attente" stackId="a" fill={COLORS.pending} stroke="#fff" strokeWidth={2} maxBarSize={42} />
              <Bar dataKey="approved" name="Acceptées" stackId="a" fill={COLORS.approved} stroke="#fff" strokeWidth={2} maxBarSize={42} />
              <Bar dataKey="rejected" name="Refusées" stackId="a" fill={COLORS.rejected} stroke="#fff" strokeWidth={2} maxBarSize={42} />
              <Bar dataKey="activated" name="Accès actifs" stackId="a" fill={COLORS.activated} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Évolution mensuelle" subtitle="Demandes créées et décisions des chefs">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" {...AXIS_PROPS} />
              <YAxis allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="created" name="Créées" stroke={COLORS.created} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="approved" name="Acceptées" stroke={COLORS.activated} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="rejected" name="Refusées" stroke={COLORS.rejected} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Demandes par type de formulaire" subtitle="Les 6 formulaires numérisés">
          <ResponsiveContainer width="100%" height={Math.max(200, typeData.length * 40)}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="label" width={150} {...AXIS_PROPS} />
              <Tooltip />
              <Bar dataKey="total" name="Demandes" fill={COLORS.created} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Répartition par statut" subtitle="Toutes demandes confondues">
          <ResponsiveContainer width="100%" height={Math.max(200, statusData.length * 40)}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="label" width={140} {...AXIS_PROPS} />
              <Tooltip />
              <Bar dataKey="count" name="Demandes" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_HEX[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card
        title="Demandes récentes"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/requests')}>
            Voir toutes les demandes
          </Button>
        }
        noPadding
      >
        <DataTable
          columns={recentColumns}
          data={recent.data?.data ?? []}
          rowKey={(row) => row._id}
          loading={recent.loading}
          emptyTitle="Aucune demande"
          onRowClick={(row) => navigate(`/requests/${row._id}`)}
        />
      </Card>
    </>
  );
}

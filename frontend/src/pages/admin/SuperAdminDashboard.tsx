import { Link } from 'react-router-dom';
import {
  Building2,
  FileSliders,
  FileText,
  MailWarning,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { auditLogsApi } from '../../api/auditLogs.api';
import { statisticsApi } from '../../api/statistics.api';
import { usersApi } from '../../api/users.api';
import { Alert } from '../../components/ui/Alert';
import { Badge, RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useApi } from '../../hooks/useApi';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import { AuditLog, FormDefinition, Role, User } from '../../types';
import { formatDateTime, timeAgo } from '../../utils/date';
import { AUDIT_ACTION_LABELS, ROLE_LABELS } from '../../utils/labels';

/**
 * Console de supervision du super administrateur : état des comptes, des
 * formulaires et des demandes, avec accès direct aux fonctions de gestion.
 */
export default function SuperAdminDashboard() {
  const { definitions, loading: formsLoading } = useFormDefinitions();
  const summary = useApi(() => usersApi.summary(), []);
  const overview = useApi(() => statisticsApi.overview(), []);
  const audit = useApi(() => auditLogsApi.list({ limit: 8 }), []);

  const byRole = summary.data?.byRole;
  const pending = summary.data?.pendingActivation ?? [];
  const totalUsers = byRole ? Object.values(byRole).reduce((total, count) => total + count, 0) : 0;
  const admins = byRole ? (byRole[Role.ADMIN] ?? 0) + (byRole[Role.SUPER_ADMIN] ?? 0) : 0;
  const activeForms = definitions.filter((definition) => definition.isActive).length;

  const formColumns: Column<FormDefinition>[] = [
    {
      key: 'title',
      header: 'Formulaire',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.title}</div>
          <div className="text-small text-muted">
            {row.fields.length} champ(s) spécifique(s) · version {row.version}
          </div>
        </div>
      ),
    },
    {
      key: 'blocks',
      header: 'Blocs demandés',
      render: (row) => (
        <div className="flex-row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {row.requiresAccessType && <Badge color="blue">Type d’accès</Badge>}
          {row.requiresDuration && <Badge color="cyan">Durée</Badge>}
          {row.requiresJustification && <Badge color="purple">Justification</Badge>}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Disponibilité',
      render: (row) =>
        row.isActive ? (
          <Badge color="green" withDot>
            Proposé aux employés
          </Badge>
        ) : (
          <Badge color="slate">Retiré du catalogue</Badge>
        ),
    },
    {
      key: 'updatedAt',
      header: 'Dernière modification',
      render: (row) => (
        <div>
          <div>{formatDateTime(row.updatedAt)}</div>
          {row.updatedBy && (
            <div className="text-small text-muted">
              par {row.updatedBy.firstName} {row.updatedBy.lastName}
            </div>
          )}
        </div>
      ),
    },
  ];

  const pendingColumns: Column<User>[] = [
    {
      key: 'user',
      header: 'Compte en attente',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.firstName} {row.lastName}
          </div>
          <div className="text-small text-muted">{row.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Rôle', render: (row) => <RoleBadge role={row.role} /> },
    { key: 'department', header: 'Département', render: (row) => row.department?.name ?? '—' },
    {
      key: 'invited',
      header: 'Créé',
      render: (row) => timeAgo(row.createdAt),
    },
  ];

  const auditColumns: Column<AuditLog>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => AUDIT_ACTION_LABELS[row.action] ?? row.action,
    },
    {
      key: 'user',
      header: 'Auteur',
      render: (row) => (
        <div>
          <div>{row.userEmail}</div>
          {row.user?.role && (
            <div className="text-small text-muted">{ROLE_LABELS[row.user.role]}</div>
          )}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Quand', render: (row) => timeAgo(row.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Supervision de l’application"
        subtitle="Comptes, formulaires, référentiels et traçabilité"
        actions={
          <div className="flex-row">
            <Link to="/admin/forms">
              <Button icon={<FileSliders size={16} />}>Gérer les formulaires</Button>
            </Link>
            <Link to="/admin/users">
              <Button variant="secondary" icon={<UserCog size={16} />}>
                Gérer les comptes
              </Button>
            </Link>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard
          label="Comptes au total"
          value={totalUsers}
          icon={<Users size={20} />}
          accent="blue"
          hint={`${admins} compte(s) d’administration`}
        />
        <StatCard
          label="En attente d’activation"
          value={pending.length}
          icon={<MailWarning size={20} />}
          accent={pending.length > 0 ? 'amber' : 'green'}
          hint="Lien d’accès non encore utilisé"
        />
        <StatCard
          label="Formulaires actifs"
          value={`${activeForms}/${definitions.length}`}
          icon={<FileSliders size={20} />}
          accent="purple"
          hint="Proposés aux employés"
        />
        <StatCard
          label="Demandes enregistrées"
          value={overview.data?.total ?? '—'}
          icon={<FileText size={20} />}
          accent="cyan"
          hint={`${overview.data?.pendingManager ?? 0} en attente de validation`}
        />
      </div>

      <Alert variant="info">
        En tant que super administrateur, vous supervisez l’application : gestion des
        administrateurs, des formulaires et des référentiels. Le circuit de validation reste porté
        par les chefs de département et l’équipe réseau (séparation des tâches).
      </Alert>

      <Card
        title="Catalogue des formulaires"
        subtitle="Contenu et disponibilité des 6 formulaires numérisés"
        actions={
          <Link to="/admin/forms">
            <Button size="sm" variant="secondary" icon={<FileSliders size={15} />}>
              Modifier
            </Button>
          </Link>
        }
        noPadding
      >
        <DataTable
          columns={formColumns}
          data={definitions}
          rowKey={(row) => row.requestType}
          loading={formsLoading}
          emptyTitle="Aucun formulaire"
        />
      </Card>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <Card
          title="Comptes en attente d’activation"
          subtitle="Employés dont le lien d’accès n’a pas encore été utilisé"
          noPadding
        >
          {pending.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={26} />}
              title="Aucun compte en attente"
              message="Tous les comptes créés ont défini leur mot de passe."
            />
          ) : (
            <DataTable
              columns={pendingColumns}
              data={pending}
              rowKey={(row) => row._id}
              loading={summary.loading}
              emptyTitle="Aucun compte en attente"
            />
          )}
        </Card>

        <Card
          title="Dernières actions tracées"
          subtitle="Extrait du journal d’audit"
          actions={
            <Link to="/audit-logs">
              <Button size="sm" variant="secondary" icon={<ScrollText size={15} />}>
                Tout voir
              </Button>
            </Link>
          }
          noPadding
        >
          <DataTable
            columns={auditColumns}
            data={audit.data?.data ?? []}
            rowKey={(row) => row._id}
            loading={audit.loading}
            emptyTitle="Journal vide"
          />
        </Card>
      </div>

      <Card title="Référentiels" subtitle="Structure de l’organisation">
        <div className="flex-row">
          <Link to="/admin/departments">
            <Button variant="secondary" icon={<Building2 size={16} />}>
              Départements
            </Button>
          </Link>
          <Link to="/admin/services">
            <Button variant="secondary" icon={<Building2 size={16} />}>
              Services
            </Button>
          </Link>
          <Link to="/requests">
            <Button variant="secondary" icon={<FileText size={16} />}>
              Toutes les demandes
            </Button>
          </Link>
        </div>
      </Card>
    </>
  );
}

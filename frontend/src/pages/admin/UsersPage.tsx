import { FormEvent, useEffect, useState } from 'react';
import { Copy, KeyRound, Link2, Pencil, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { departmentsApi } from '../../api/departments.api';
import { servicesApi } from '../../api/services.api';
import { usersApi, UserPayload } from '../../api/users.api';
import { Alert } from '../../components/ui/Alert';
import { Badge, RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { FormField, Input, Select } from '../../components/ui/FormField';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import {
  accountState,
  ActivationLink,
  Department,
  PRIVILEGED_ROLES,
  Role,
  ServiceEntity,
  User,
} from '../../types';
import { formatDateTime } from '../../utils/date';
import {
  ACCOUNT_STATE_COLORS,
  ACCOUNT_STATE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_OPTIONS,
} from '../../utils/labels';

/** Bloc d'affichage du lien d'accès temporaire (visible une seule fois) */
function ActivationLinkPanel({ link, name }: { link: ActivationLink; name: string }) {
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success('Lien copié dans le presse-papiers.');
    } catch {
      toast.error('Copie impossible : sélectionnez le lien manuellement.');
    }
  };

  return (
    <>
      <Alert variant="success">
        {link.isReset
          ? `Un lien de réinitialisation a été généré pour ${name}.`
          : `Le compte de ${name} est créé. Transmettez-lui ce lien pour qu'il définisse son mot de passe.`}
      </Alert>
      <div className="activation-link-box">
        <code>{link.url}</code>
        <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={copy}>
          Copier
        </Button>
      </div>
      <p className="text-small text-muted">
        Lien à usage unique, valable jusqu’au <strong>{formatDateTime(link.expiresAt)}</strong>. Il
        devient inutilisable dès que le mot de passe est défini. Ce lien n’est affiché qu’une fois :
        un nouveau peut être généré à tout moment depuis la liste des utilisateurs.
      </p>
    </>
  );
}

interface UserFormModalProps {
  open: boolean;
  user: User | null;
  departments: Department[];
  assignableRoles: { value: Role; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({
  open,
  user,
  departments,
  assignableRoles,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const toast = useToast();
  const isEdit = user !== null;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    matricule: '',
    email: '',
    role: Role.EMPLOYEE as Role,
    department: '',
    service: '',
    position: '',
  });
  const [services, setServices] = useState<ServiceEntity[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ link: ActivationLink; name: string } | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setErrors({});
      setCreatedLink(null);
      setForm({
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        matricule: user?.matricule ?? '',
        email: user?.email ?? '',
        role: user?.role ?? Role.EMPLOYEE,
        department: user?.department?._id ?? '',
        service: user?.service?._id ?? '',
        position: user?.position ?? '',
      });
    }
  }, [open, user?._id]);

  useEffect(() => {
    if (!form.department) {
      setServices([]);
      return;
    }
    servicesApi
      .list(form.department)
      .then(setServices)
      .catch(() => setServices([]));
  }, [form.department]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Le prénom est obligatoire.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Le nom est obligatoire.';
    if (!form.matricule.trim()) nextErrors.matricule = 'Le matricule est obligatoire.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = "L'adresse email est invalide.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: UserPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      matricule: form.matricule.trim(),
      email: form.email.trim(),
      role: form.role,
      department: form.department || null,
      service: form.service || null,
      position: form.position.trim(),
    };

    setSubmitting(true);
    try {
      if (isEdit && user) {
        await usersApi.update(user._id, payload);
        toast.success('Utilisateur mis à jour.');
        onSaved();
        onClose();
      } else {
        const created = await usersApi.create(payload);
        // Le lien n'est renvoyé qu'à la création : on l'affiche avant de fermer
        setCreatedLink({
          link: created.activation,
          name: `${created.user.firstName} ${created.user.lastName}`,
        });
        onSaved();
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (createdLink) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Compte créé — lien d’activation"
        width={620}
        footer={<Button onClick={onClose}>Terminer</Button>}
      >
        <ActivationLinkPanel link={createdLink.link} name={createdLink.name} />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Modifier ${user?.firstName} ${user?.lastName}` : 'Nouvel utilisateur'}
      width={640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Enregistrer' : 'Créer le compte'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {!isEdit && (
          <Alert variant="info">
            Aucun mot de passe n’est saisi ici : à la création, l’application génère un lien
            d’activation temporaire que l’employé utilisera pour définir lui-même son mot de passe.
          </Alert>
        )}
        <div className="form-grid">
          <FormField label="Prénom" required error={errors.firstName}>
            <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} hasError={!!errors.firstName} />
          </FormField>
          <FormField label="Nom" required error={errors.lastName}>
            <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} hasError={!!errors.lastName} />
          </FormField>
          <FormField label="Matricule" required error={errors.matricule}>
            <Input value={form.matricule} onChange={(e) => set('matricule', e.target.value)} hasError={!!errors.matricule} placeholder="PGH-0042" />
          </FormField>
          <FormField label="Email professionnel" required error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} hasError={!!errors.email} />
          </FormField>
          <FormField label="Rôle" required hint={ROLE_DESCRIPTIONS[form.role]}>
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {assignableRoles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Département">
            <Select
              value={form.department}
              onChange={(e) => {
                set('department', e.target.value);
                set('service', '');
              }}
            >
              <option value="">— Aucun —</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Service">
            <Select value={form.service} onChange={(e) => set('service', e.target.value)} disabled={!form.department}>
              <option value="">— Aucun —</option>
              {services.map((service) => (
                <option key={service._id} value={service._id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Poste" className="full-width">
            <Input value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="Ex : Développeur, Comptable..." />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [department, setDepartment] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toToggle, setToToggle] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [toLink, setToLink] = useState<User | null>(null);
  const [issuedLink, setIssuedLink] = useState<{ link: ActivationLink; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isSuperAdmin = currentUser?.role === Role.SUPER_ADMIN;
  // Un administrateur simple ne peut pas créer ni promouvoir un compte privilégié
  const assignableRoles = ROLE_OPTIONS.filter(
    (option) => isSuperAdmin || !PRIVILEGED_ROLES.includes(option.value),
  );

  const debouncedSearch = useDebounce(search);
  const departments = useApi(() => departmentsApi.list(), []);
  const list = useApi(
    () =>
      usersApi.list({
        page,
        limit: 10,
        search: debouncedSearch,
        role,
        department,
        isActive: stateFilter === 'disabled' ? false : stateFilter === 'active' ? true : '',
        pendingActivation: stateFilter === 'pending' ? true : '',
      }),
    [page, debouncedSearch, role, department, stateFilter],
  );

  const handleToggle = async () => {
    if (!toToggle) return;
    setActionLoading(true);
    try {
      if (toToggle.isActive) {
        await usersApi.deactivate(toToggle._id);
        toast.success(`Compte de ${toToggle.firstName} ${toToggle.lastName} désactivé.`);
      } else {
        await usersApi.activate(toToggle._id);
        toast.success(`Compte de ${toToggle.firstName} ${toToggle.lastName} réactivé.`);
      }
      setToToggle(null);
      list.reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setActionLoading(true);
    try {
      await usersApi.remove(toDelete._id);
      toast.success('Utilisateur supprimé.');
      setToDelete(null);
      list.reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueLink = async () => {
    if (!toLink) return;
    setActionLoading(true);
    try {
      const link = await usersApi.issueActivationLink(toLink._id);
      setIssuedLink({ link, name: `${toLink.firstName} ${toLink.lastName}` });
      setToLink(null);
      list.reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.firstName} {row.lastName}
          </div>
          <div className="text-small text-muted">{row.email}</div>
          {row.emailIsTemporary && (
            <Badge color="amber">Email temporaire — SSO indisponible</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'matricule',
      header: 'Matricule',
      render: (row) => <span className="font-mono">{row.matricule}</span>,
    },
    { key: 'role', header: 'Rôle', render: (row) => <RoleBadge role={row.role} /> },
    {
      key: 'department',
      header: 'Département',
      render: (row) => (
        <div>
          <div>{row.department?.name ?? '—'}</div>
          {row.service && <div className="text-small text-muted">{row.service.name}</div>}
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Responsable direct',
      render: (row) =>
        row.manager ? (
          <span className="text-small">
            {row.manager.firstName} {row.manager.lastName}
          </span>
        ) : (
          <span className="text-small text-muted">—</span>
        ),
    },
    {
      key: 'state',
      header: 'État du compte',
      render: (row) => {
        const state = accountState(row);
        return (
          <div>
            <Badge color={ACCOUNT_STATE_COLORS[state]}>{ACCOUNT_STATE_LABELS[state]}</Badge>
            {row.mustChangePassword && (
              <div className="text-small text-muted" style={{ marginTop: 3 }}>
                Changement de mot de passe imposé
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'lastLoginAt',
      header: 'Dernière connexion',
      render: (row) => formatDateTime(row.lastLoginAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex-row" style={{ flexWrap: 'nowrap', gap: 4 }}>
          <Button
            size="sm"
            variant="ghost"
            title="Modifier"
            icon={<Pencil size={15} />}
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            title={
              row.activatedAt
                ? 'Générer un lien de réinitialisation du mot de passe'
                : 'Générer un nouveau lien d’activation'
            }
            icon={row.activatedAt ? <KeyRound size={15} /> : <Link2 size={15} />}
            onClick={() => setToLink(row)}
          />
          <Button
            size="sm"
            variant="ghost"
            title={row.isActive ? 'Désactiver' : 'Réactiver'}
            icon={row.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
            onClick={() => setToToggle(row)}
          />
          <Button
            size="sm"
            variant="ghost"
            title="Supprimer"
            icon={<Trash2 size={15} />}
            onClick={() => setToDelete(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Gestion des utilisateurs"
        subtitle="Comptes, rôles, affectations et liens d’accès temporaires"
        actions={
          <Button
            icon={<UserPlus size={16} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Nouvel utilisateur
          </Button>
        }
      />

      {!isSuperAdmin && (
        <Alert variant="info">
          La gestion des comptes administrateurs est réservée au super administrateur.
        </Alert>
      )}

      <Card noPadding>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Nom, email, matricule..."
          />
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | '');
              setPage(1);
            }}
            style={{ maxWidth: 200 }}
          >
            <option value="">Tous les rôles</option>
            {ROLE_OPTIONS.map((option) => (
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
            style={{ maxWidth: 200 }}
          >
            <option value="">Tous les départements</option>
            {(departments.data ?? []).map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 200 }}
          >
            <option value="">Tous les états</option>
            <option value="active">Actifs</option>
            <option value="pending">En attente d’activation</option>
            <option value="disabled">Désactivés</option>
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          rowKey={(row) => row._id}
          loading={list.loading}
          emptyTitle="Aucun utilisateur trouvé"
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

      <UserFormModal
        open={formOpen}
        user={editing}
        departments={departments.data ?? []}
        assignableRoles={assignableRoles}
        onClose={() => setFormOpen(false)}
        onSaved={list.reload}
      />

      {/* Lien généré depuis la liste (renvoi d'invitation ou réinitialisation) */}
      <Modal
        open={issuedLink !== null}
        onClose={() => setIssuedLink(null)}
        title="Lien d’accès temporaire"
        width={620}
        footer={<Button onClick={() => setIssuedLink(null)}>Terminer</Button>}
      >
        {issuedLink && <ActivationLinkPanel link={issuedLink.link} name={issuedLink.name} />}
      </Modal>

      <ConfirmDialog
        open={toLink !== null}
        title={toLink?.activatedAt ? 'Réinitialiser le mot de passe' : 'Renvoyer le lien d’activation'}
        message={
          toLink?.activatedAt ? (
            <>
              Un lien temporaire sera généré pour {toLink?.firstName} {toLink?.lastName}, et un
              changement de mot de passe lui sera imposé à sa prochaine connexion. Son mot de passe
              actuel reste utilisable jusqu’à ce changement.
            </>
          ) : (
            <>
              Un nouveau lien d’activation sera généré pour {toLink?.firstName} {toLink?.lastName}.
              Tout lien précédent devient immédiatement invalide.
            </>
          )
        }
        confirmLabel="Générer le lien"
        loading={actionLoading}
        onConfirm={handleIssueLink}
        onCancel={() => setToLink(null)}
      />

      <ConfirmDialog
        open={toToggle !== null}
        title={toToggle?.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
        message={
          toToggle?.isActive
            ? `Désactiver le compte de ${toToggle?.firstName} ${toToggle?.lastName} ? Il ne pourra plus se connecter.`
            : `Réactiver le compte de ${toToggle?.firstName} ${toToggle?.lastName} ?`
        }
        confirmLabel={toToggle?.isActive ? 'Désactiver' : 'Réactiver'}
        variant={toToggle?.isActive ? 'danger' : 'primary'}
        loading={actionLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer l'utilisateur"
        message={
          <>
            Supprimer définitivement le compte de {toDelete?.firstName} {toDelete?.lastName} ? Cette
            action est irréversible. Si ce compte est déjà intervenu dans des demandes, la
            suppression sera refusée : préférez la désactivation pour préserver la traçabilité.
          </>
        }
        confirmLabel="Supprimer"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

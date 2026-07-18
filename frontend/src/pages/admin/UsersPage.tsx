import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { departmentsApi } from '../../api/departments.api';
import { servicesApi } from '../../api/services.api';
import { usersApi, UserPayload } from '../../api/users.api';
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
import { useToast } from '../../store/ToastContext';
import { Department, Role, ServiceEntity, User } from '../../types';
import { formatDateTime } from '../../utils/date';
import { ROLE_OPTIONS } from '../../utils/labels';

interface UserFormModalProps {
  open: boolean;
  user: User | null;
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ open, user, departments, onClose, onSaved }: UserFormModalProps) {
  const toast = useToast();
  const isEdit = user !== null;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    matricule: '',
    email: '',
    password: '',
    role: Role.EMPLOYEE as Role,
    department: '',
    service: '',
    position: '',
  });
  const [services, setServices] = useState<ServiceEntity[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm({
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        matricule: user?.matricule ?? '',
        email: user?.email ?? '',
        password: '',
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
    if (!isEdit && form.password.length < 8) {
      nextErrors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (isEdit && form.password && form.password.length < 8) {
      nextErrors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    }
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
    if (form.password) {
      payload.password = form.password;
    }

    setSubmitting(true);
    try {
      if (isEdit && user) {
        await usersApi.update(user._id, payload);
        toast.success('Utilisateur mis à jour.');
      } else {
        await usersApi.create(payload);
        toast.success('Utilisateur créé.');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

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
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
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
          <FormField
            label="Mot de passe"
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? 'Laisser vide pour conserver le mot de passe actuel.' : '8 caractères minimum.'}
          >
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} hasError={!!errors.password} autoComplete="new-password" />
          </FormField>
          <FormField label="Rôle" required>
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ROLE_OPTIONS.map((option) => (
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [department, setDepartment] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toToggle, setToToggle] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
        isActive: activeFilter === '' ? '' : activeFilter === 'active',
      }),
    [page, debouncedSearch, role, department, activeFilter],
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
    { key: 'position', header: 'Poste', render: (row) => row.position || '—' },
    {
      key: 'isActive',
      header: 'Statut',
      render: (row) =>
        row.isActive ? <Badge color="green">Actif</Badge> : <Badge color="slate">Inactif</Badge>,
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
        subtitle="Comptes, rôles et affectations aux départements et services"
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
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 150 }}
          >
            <option value="">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
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
        onClose={() => setFormOpen(false)}
        onSaved={list.reload}
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
        message={`Supprimer définitivement le compte de ${toDelete?.firstName} ${toDelete?.lastName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

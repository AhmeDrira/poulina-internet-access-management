import { FormEvent, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { departmentsApi, DepartmentPayload } from '../../api/departments.api';
import { usersApi } from '../../api/users.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../store/ToastContext';
import { Department, Role, User } from '../../types';
import { fullName } from '../../utils/labels';

export default function DepartmentsPage() {
  const toast = useToast();
  const { data: departments, loading, reload } = useApi(() => departmentsApi.list(), []);
  const [managers, setManagers] = useState<User[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({ name: '', code: '', description: '', manager: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    usersApi
      .list({ role: Role.MANAGER, limit: 100 })
      .then((result) => setManagers(result.data))
      .catch(() => setManagers([]));
  }, []);

  const openForm = (department: Department | null) => {
    setEditing(department);
    setErrors({});
    setForm({
      name: department?.name ?? '',
      code: department?.code ?? '',
      description: department?.description ?? '',
      manager: department?.manager?._id ?? '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Le nom est obligatoire.';
    if (!form.code.trim()) nextErrors.code = 'Le code est obligatoire.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: DepartmentPayload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      manager: form.manager || null,
    };
    setActionLoading(true);
    try {
      if (editing) {
        await departmentsApi.update(editing._id, payload);
        toast.success('Département mis à jour.');
      } else {
        await departmentsApi.create(payload);
        toast.success('Département créé.');
      }
      setFormOpen(false);
      reload();
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
      await departmentsApi.remove(toDelete._id);
      toast.success('Département supprimé.');
      setToDelete(null);
      reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<Department>[] = [
    { key: 'name', header: 'Nom', render: (row) => <span style={{ fontWeight: 600 }}>{row.name}</span> },
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <Badge color="slate">
          <span className="font-mono">{row.code}</span>
        </Badge>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-muted" title={row.description}>
          {row.description.length > 70 ? `${row.description.slice(0, 70)}…` : row.description || '—'}
        </span>
      ),
    },
    { key: 'manager', header: 'Chef de département', render: (row) => fullName(row.manager) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex-row" style={{ flexWrap: 'nowrap', gap: 4 }}>
          <Button size="sm" variant="ghost" title="Modifier" icon={<Pencil size={15} />} onClick={() => openForm(row)} />
          <Button size="sm" variant="ghost" title="Supprimer" icon={<Trash2 size={15} />} onClick={() => setToDelete(row)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Gestion des départements"
        subtitle="Chaque département possède un chef responsable de la validation des demandes"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Nouveau département
          </Button>
        }
      />
      <Card noPadding>
        <DataTable
          columns={columns}
          data={departments ?? []}
          rowKey={(row) => row._id}
          loading={loading}
          emptyIcon={<Building2 size={26} />}
          emptyTitle="Aucun département"
          emptyMessage="Créez le premier département de l'organisation."
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Modifier ${editing.name}` : 'Nouveau département'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={actionLoading}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} loading={actionLoading}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Nom" required error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} hasError={!!errors.name} />
          </FormField>
          <FormField label="Code" required error={errors.code} hint="8 caractères maximum (ex : IT, FIN, MKT)">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              hasError={!!errors.code}
              maxLength={8}
            />
          </FormField>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormField>
          <FormField label="Chef de département" hint="Utilisateur avec le rôle « Chef de département »">
            <Select value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}>
              <option value="">— Aucun —</option>
              {managers.map((manager) => (
                <option key={manager._id} value={manager._id}>
                  {manager.firstName} {manager.lastName} ({manager.email})
                </option>
              ))}
            </Select>
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer le département"
        message={`Supprimer le département ${toDelete?.name} ? La suppression sera refusée s'il contient des utilisateurs ou des services.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

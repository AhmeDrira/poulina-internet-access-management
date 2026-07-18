import { FormEvent, useState } from 'react';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { departmentsApi } from '../../api/departments.api';
import { servicesApi, ServicePayload } from '../../api/services.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Column, DataTable } from '../../components/ui/DataTable';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../store/ToastContext';
import { ServiceEntity } from '../../types';

export default function ServicesPage() {
  const toast = useToast();
  const [departmentFilter, setDepartmentFilter] = useState('');
  const departments = useApi(() => departmentsApi.list(), []);
  const services = useApi(
    () => servicesApi.list(departmentFilter || undefined),
    [departmentFilter],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceEntity | null>(null);
  const [toDelete, setToDelete] = useState<ServiceEntity | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openForm = (service: ServiceEntity | null) => {
    setEditing(service);
    setErrors({});
    setForm({
      name: service?.name ?? '',
      department: service?.department?._id ?? departmentFilter,
      description: service?.description ?? '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Le nom est obligatoire.';
    if (!form.department) nextErrors.department = 'Le département est obligatoire.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: ServicePayload = {
      name: form.name.trim(),
      department: form.department,
      description: form.description.trim(),
    };
    setActionLoading(true);
    try {
      if (editing) {
        await servicesApi.update(editing._id, payload);
        toast.success('Service mis à jour.');
      } else {
        await servicesApi.create(payload);
        toast.success('Service créé.');
      }
      setFormOpen(false);
      services.reload();
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
      await servicesApi.remove(toDelete._id);
      toast.success('Service supprimé.');
      setToDelete(null);
      services.reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<ServiceEntity>[] = [
    { key: 'name', header: 'Nom', render: (row) => <span style={{ fontWeight: 600 }}>{row.name}</span> },
    { key: 'department', header: 'Département', render: (row) => row.department?.name ?? '—' },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="text-muted">{row.description || '—'}</span>,
    },
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
        title="Gestion des services"
        subtitle="Unités rattachées aux départements"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Nouveau service
          </Button>
        }
      />
      <Card noPadding>
        <div className="table-toolbar">
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{ maxWidth: 260 }}
          >
            <option value="">Tous les départements</option>
            {(departments.data ?? []).map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={services.data ?? []}
          rowKey={(row) => row._id}
          loading={services.loading}
          emptyIcon={<Layers size={26} />}
          emptyTitle="Aucun service"
          emptyMessage="Créez un service rattaché à un département."
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Modifier ${editing.name}` : 'Nouveau service'}
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
          <FormField label="Département" required error={errors.department}>
            <Select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              hasError={!!errors.department}
            >
              <option value="">— Choisir un département —</option>
              {(departments.data ?? []).map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer le service"
        message={`Supprimer le service ${toDelete?.name} ? La suppression sera refusée si des utilisateurs y sont affectés.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

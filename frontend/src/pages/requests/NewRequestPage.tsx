import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { requestsApi } from '../../api/requests.api';
import { servicesApi } from '../../api/services.api';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../store/ToastContext';
import { useAuth } from '../../store/AuthContext';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import {
  AccessRequest,
  AccessType,
  DurationType,
  FormFieldKind,
  RequestStatus,
  RequestType,
  ServiceEntity,
} from '../../types';
import { commitmentFields, inputFields, validateFieldValue } from '../../utils/formDefinitions';
import {
  ACCESS_TYPE_DESCRIPTIONS,
  ACCESS_TYPE_OPTIONS,
  DURATION_OPTIONS,
} from '../../utils/labels';

/**
 * Formulaire dynamique : sert à la fois à
 *  - créer une demande (/requests/new/:type)
 *  - modifier et re-soumettre une demande (/requests/:id/edit, statut « modifications demandées »)
 *
 * Les champs, consignes et blocs demandés proviennent de la définition du
 * formulaire en base (gérée par le super administrateur).
 */
export default function NewRequestPage({ editMode = false }: { editMode?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const params = useParams<{ type?: string; id?: string }>();
  const { get: getDefinition, loading: definitionsLoading } = useFormDefinitions();

  // --- Mode édition : chargement de la demande existante ---
  const existing = useApi<AccessRequest | null>(
    () => (editMode && params.id ? requestsApi.get(params.id) : Promise.resolve(null)),
    [editMode, params.id],
  );

  const requestType = editMode
    ? existing.data?.requestType
    : (params.type as RequestType | undefined);
  const typeIsValid =
    !!requestType && Object.values(RequestType).includes(requestType as RequestType);

  const definition = typeIsValid ? getDefinition(requestType as RequestType) : undefined;
  const specificFields = useMemo(() => inputFields(definition), [definition]);
  const commitments = useMemo(() => commitmentFields(definition), [definition]);

  const [services, setServices] = useState<ServiceEntity[]>([]);
  const [position, setPosition] = useState(user?.position ?? '');
  const [serviceId, setServiceId] = useState(user?.service?._id ?? '');
  const [accessType, setAccessType] = useState<AccessType>(AccessType.STANDARD);
  const [durationType, setDurationType] = useState<DurationType>(DurationType.TEMPORARY);
  const [durationDays, setDurationDays] = useState('90');
  const [justification, setJustification] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [resubmitComment, setResubmitComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<AccessRequest | null>(null);

  // Pré-remplissage en mode édition
  useEffect(() => {
    const request = existing.data;
    if (!editMode || !request) return;
    setPosition(request.position ?? '');
    setServiceId(request.service?._id ?? '');
    setAccessType(request.accessType ?? AccessType.STANDARD);
    setDurationType(request.durationType);
    setDurationDays(request.durationDays ? String(request.durationDays) : '90');
    setJustification(request.justification ?? '');
    setFormData(request.formData ?? {});
  }, [editMode, existing.data?._id]);

  useEffect(() => {
    if (!user?.department) return;
    servicesApi
      .list(user.department._id)
      .then(setServices)
      .catch(() => setServices([]));
  }, [user?.department?._id]);

  if (!user) return null;

  // --- Garde-fous ---
  if (!editMode && !typeIsValid) {
    return <Navigate to="/requests/new" replace />;
  }
  if ((editMode && existing.loading) || definitionsLoading) {
    return <LoadingBlock />;
  }
  if (editMode && (!existing.data || existing.data.status !== RequestStatus.CHANGES_REQUESTED)) {
    return (
      <>
        <PageHeader title="Modification impossible" />
        <Alert variant="danger">
          Cette demande ne peut pas être modifiée : elle n'est pas (ou plus) au statut «
          Modifications demandées ».
        </Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Retour
        </Button>
      </>
    );
  }

  if (!user.department) {
    return (
      <>
        <PageHeader title="Nouvelle demande" />
        <Alert variant="danger">
          Votre compte n'est rattaché à aucun département : impossible de soumettre une demande.
          Contactez l'administrateur pour mettre à jour votre profil.
        </Alert>
      </>
    );
  }

  if (!definition) {
    return (
      <>
        <PageHeader title="Nouvelle demande" />
        <Alert variant="danger">
          Ce formulaire est introuvable ou n'est plus disponible. Retournez au choix du formulaire.
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/requests/new')}>
          Choisir un formulaire
        </Button>
      </>
    );
  }

  // Un formulaire retiré du catalogue reste modifiable en re-soumission,
  // mais n'accepte plus de nouveau dépôt.
  if (!editMode && !definition.isActive) {
    return (
      <>
        <PageHeader title={definition.title} />
        <Alert variant="warning">
          Ce formulaire n'est plus proposé actuellement. Contactez le service informatique si vous
          en avez besoin.
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/requests/new')}>
          Choisir un autre formulaire
        </Button>
      </>
    );
  }

  if (created) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <CheckCircle2 size={52} style={{ color: 'var(--green-600)', marginBottom: 14 }} />
            <h2 style={{ marginBottom: 8 }}>Demande {created.reference} soumise avec succès</h2>
            <p className="text-muted" style={{ marginBottom: 22 }}>
              Elle a été transmise au chef de votre département pour validation. Vous serez
              notifié à chaque changement de statut.
            </p>
            <div className="flex-row" style={{ justifyContent: 'center' }}>
              <Button onClick={() => navigate(`/requests/${created._id}`)}>Voir ma demande</Button>
              <Button variant="secondary" onClick={() => navigate('/')}>
                Retour au tableau de bord
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const type = requestType as RequestType;
  const withDuration = definition.requiresDuration;
  const withJustification = definition.requiresJustification;

  const setField = (key: string, value: unknown) =>
    setFormData((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const days = Number(durationDays);

    if (withDuration && durationType === DurationType.TEMPORARY) {
      if (!durationDays || Number.isNaN(days) || days < 1 || days > 730) {
        nextErrors.durationDays = 'Indiquez une durée entre 1 et 730 jours.';
      }
    }
    if (withJustification && justification.trim().length < 10) {
      nextErrors.justification = 'La justification doit contenir au moins 10 caractères.';
    }
    for (const field of definition.fields) {
      const message = validateFieldValue(field, formData[field.key]);
      if (message) nextErrors[field.key] = message;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      accessType: definition.requiresAccessType ? accessType : undefined,
      durationType: withDuration ? durationType : DurationType.PERMANENT,
      durationDays:
        withDuration && durationType === DurationType.TEMPORARY ? days : undefined,
      justification: withJustification ? justification.trim() : undefined,
      formData,
      position: position.trim() || undefined,
      serviceId: serviceId || undefined,
    };

    setSubmitting(true);
    try {
      if (editMode && existing.data) {
        await requestsApi.resubmit(existing.data._id, {
          ...payload,
          resubmitComment: resubmitComment.trim() || undefined,
        });
        toast.success('Demande modifiée et re-soumise au chef de département.');
        navigate(`/requests/${existing.data._id}`);
      } else {
        const request = await requestsApi.create({ requestType: type, ...payload });
        setCreated(request);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={editMode ? `Modifier la demande ${existing.data?.reference}` : definition.title}
        subtitle={
          editMode
            ? 'Corrigez les éléments demandés puis re-soumettez au chef de département'
            : "La demande sera envoyée automatiquement au chef de votre département"
        }
      />

      {editMode && existing.data?.managerComment && (
        <Alert variant="warning">
          <strong>Modifications demandées par le chef :</strong> {existing.data.managerComment}
        </Alert>
      )}

      {definition.instructions && <Alert variant="info">{definition.instructions}</Alert>}

      <Card title="Formulaire">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <FormField label="Nom">
              <Input value={user.lastName} disabled />
            </FormField>
            <FormField label="Prénom">
              <Input value={user.firstName} disabled />
            </FormField>
            <FormField label="Matricule">
              <Input value={user.matricule} disabled />
            </FormField>
            <FormField label="Email professionnel">
              <Input value={user.email} disabled />
            </FormField>
            <FormField label="Département">
              <Input value={user.department.name} disabled />
            </FormField>
            <FormField label="Service">
              <Select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">— Aucun service précis —</option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Poste" className="full-width">
              <Input
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Ex : Développeur, Comptable..."
                maxLength={120}
              />
            </FormField>

            {definition.requiresAccessType && (
              <FormField
                label="Type d'accès demandé"
                required
                hint={ACCESS_TYPE_DESCRIPTIONS[accessType]}
              >
                <Select
                  value={accessType}
                  onChange={(event) => setAccessType(event.target.value as AccessType)}
                >
                  {ACCESS_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            {/* Champs spécifiques au formulaire (hors engagements) */}
            {specificFields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                required={field.required}
                error={errors[field.key]}
                hint={field.helpText || undefined}
                className={field.kind === FormFieldKind.TEXTAREA ? 'full-width' : undefined}
              >
                {field.kind === FormFieldKind.SELECT ? (
                  <Select
                    value={(formData[field.key] as string) ?? ''}
                    onChange={(event) => setField(field.key, event.target.value)}
                    hasError={!!errors[field.key]}
                  >
                    <option value="">— Choisir —</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : field.kind === FormFieldKind.TEXTAREA ? (
                  <Textarea
                    rows={3}
                    value={(formData[field.key] as string) ?? ''}
                    onChange={(event) => setField(field.key, event.target.value)}
                    placeholder={field.placeholder || undefined}
                    maxLength={field.maxLength ?? undefined}
                    hasError={!!errors[field.key]}
                  />
                ) : (
                  <Input
                    type={
                      field.kind === FormFieldKind.NUMBER
                        ? 'number'
                        : field.kind === FormFieldKind.DATE
                          ? 'date'
                          : 'text'
                    }
                    min={field.min ?? undefined}
                    max={field.max ?? undefined}
                    value={(formData[field.key] as string) ?? ''}
                    onChange={(event) => setField(field.key, event.target.value)}
                    placeholder={field.placeholder || undefined}
                    maxLength={field.maxLength ?? undefined}
                    hasError={!!errors[field.key]}
                  />
                )}
              </FormField>
            ))}

            {withDuration && (
              <>
                <FormField label="Durée de l'accès" required>
                  <Select
                    value={durationType}
                    onChange={(event) => setDurationType(event.target.value as DurationType)}
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {durationType === DurationType.TEMPORARY && (
                  <FormField label="Nombre de jours" required error={errors.durationDays}>
                    <Input
                      type="number"
                      min={1}
                      max={730}
                      value={durationDays}
                      onChange={(event) => setDurationDays(event.target.value)}
                      hasError={!!errors.durationDays}
                    />
                  </FormField>
                )}
              </>
            )}

            {withJustification && (
              <FormField
                label="Justification de la demande"
                required
                className="full-width"
                error={errors.justification}
                hint={`${justification.trim().length} caractère(s) — une justification détaillée (100+ caractères) facilite la validation.`}
              >
                <Textarea
                  rows={5}
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  placeholder="Décrivez précisément le besoin métier : contexte, outils concernés, durée du besoin..."
                  hasError={!!errors.justification}
                  maxLength={2000}
                />
              </FormField>
            )}

            {/* Engagements (cases à cocher obligatoires) */}
            {commitments.map((field) => (
              <div key={field.key} className="full-width" style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    padding: '12px 14px',
                    border: `1px solid ${errors[field.key] ? 'var(--red-600)' : 'var(--slate-200)'}`,
                    borderRadius: 10,
                    background: 'var(--slate-50)',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData[field.key] === true}
                    onChange={(event) => setField(field.key, event.target.checked)}
                    style={{ marginTop: 3, width: 15, height: 15, flexShrink: 0 }}
                  />
                  <span>
                    {field.label} <span style={{ color: 'var(--red-600)' }}>*</span>
                  </span>
                </label>
                {errors[field.key] && <div className="form-error">{errors[field.key]}</div>}
              </div>
            ))}

            {editMode && (
              <FormField label="Message accompagnant la re-soumission (optionnel)" className="full-width">
                <Textarea
                  rows={2}
                  value={resubmitComment}
                  onChange={(event) => setResubmitComment(event.target.value)}
                  placeholder="Ex : période précisée du 20 au 27 juillet, périmètre limité au serveur de recette."
                  maxLength={1000}
                />
              </FormField>
            )}
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(editMode ? `/requests/${existing.data?._id}` : '/requests/new')}
            >
              {editMode ? 'Annuler' : 'Changer de formulaire'}
            </Button>
            <Button type="submit" loading={submitting}>
              {editMode ? 'Re-soumettre la demande' : 'Soumettre la demande'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { FormDefinitionPayload, FormFieldPayload, formsApi } from '../../api/forms.api';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField';
import { ConfirmDialog } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useApi } from '../../hooks/useApi';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import { useToast } from '../../store/ToastContext';
import { FormDefinition, FormFieldKind, FormUsage, RequestType } from '../../types';
import {
  FORM_FIELD_KIND_LABELS,
  FORM_FIELD_KIND_OPTIONS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
} from '../../utils/labels';

/** Champ en cours d'édition (identifiant local pour la réorganisation) */
interface EditableField extends FormFieldPayload {
  uid: string;
}

let uidCounter = 0;
const nextUid = () => `f${(uidCounter += 1)}`;

function toEditable(definition: FormDefinition): EditableField[] {
  return definition.fields.map((field) => ({
    uid: nextUid(),
    key: field.key,
    label: field.label,
    kind: field.kind,
    required: field.required,
    maxLength: field.maxLength ?? undefined,
    min: field.min ?? undefined,
    max: field.max ?? undefined,
    placeholder: field.placeholder || undefined,
    helpText: field.helpText || undefined,
    options: field.options.map((option) => ({ ...option })),
  }));
}

const KIND_WITH_LENGTH: FormFieldKind[] = [FormFieldKind.TEXT, FormFieldKind.TEXTAREA];

/**
 * Console de gestion des formulaires (super administrateur).
 * Permet d'ajuster les 6 formulaires numérisés — champs, options, ordre,
 * obligation, consignes — et de retirer un formulaire du catalogue, sans
 * toucher aux demandes déjà déposées.
 */
export default function FormsPage() {
  const toast = useToast();
  const { reload: reloadDefinitions } = useFormDefinitions();
  const list = useApi(() => formsApi.list(), []);

  const [selected, setSelected] = useState<RequestType | null>(null);
  const [draft, setDraft] = useState<FormDefinitionPayload | null>(null);
  const [fields, setFields] = useState<EditableField[]>([]);
  const [usage, setUsage] = useState<FormUsage | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const definitions = list.data ?? [];
  const current = useMemo(
    () => definitions.find((definition) => definition.requestType === selected) ?? null,
    [definitions, selected],
  );

  // Sélection du premier formulaire au chargement
  useEffect(() => {
    if (!selected && definitions.length > 0) {
      setSelected(definitions[0].requestType);
    }
  }, [definitions, selected]);

  // Chargement du brouillon d'édition à chaque changement de formulaire
  useEffect(() => {
    if (!current) return;
    setDraft({
      title: current.title,
      shortLabel: current.shortLabel,
      description: current.description,
      instructions: current.instructions,
      requiresAccessType: current.requiresAccessType,
      requiresDuration: current.requiresDuration,
      requiresJustification: current.requiresJustification,
      defaultJustification: current.defaultJustification,
    });
    setFields(toEditable(current));
    setUsage(null);
    formsApi
      .usage(current.requestType)
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [current?.requestType, current?.version]);

  const setDraftValue = <K extends keyof FormDefinitionPayload>(
    key: K,
    value: FormDefinitionPayload[K],
  ) => setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));

  const updateField = (uid: string, patch: Partial<EditableField>) =>
    setFields((previous) =>
      previous.map((field) => (field.uid === uid ? { ...field, ...patch } : field)),
    );

  const moveField = (index: number, direction: -1 | 1) =>
    setFields((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const copy = [...previous];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });

  const addField = () =>
    setFields((previous) => [
      ...previous,
      {
        uid: nextUid(),
        key: '',
        label: '',
        kind: FormFieldKind.TEXT,
        required: false,
        options: [],
      },
    ]);

  const removeField = (uid: string) =>
    setFields((previous) => previous.filter((field) => field.uid !== uid));

  const handleSave = async () => {
    if (!current || !draft) return;

    // Contrôles de surface avant appel (le serveur revalide tout)
    for (const [index, field] of fields.entries()) {
      if (!field.key.trim() || !field.label.trim()) {
        toast.error(`Champ ${index + 1} : la clé technique et le libellé sont obligatoires.`);
        return;
      }
      if (field.kind === FormFieldKind.SELECT && (field.options ?? []).length === 0) {
        toast.error(`Champ « ${field.label} » : ajoutez au moins une option.`);
        return;
      }
    }

    setSaving(true);
    try {
      await formsApi.update(current.requestType, {
        ...draft,
        fields: fields.map(({ uid: _uid, ...field }) => ({
          ...field,
          key: field.key.trim(),
          label: field.label.trim(),
          options: field.kind === FormFieldKind.SELECT ? field.options : undefined,
          maxLength: KIND_WITH_LENGTH.includes(field.kind) ? field.maxLength : undefined,
          min: field.kind === FormFieldKind.NUMBER ? field.min : undefined,
          max: field.kind === FormFieldKind.NUMBER ? field.max : undefined,
        })),
      });
      toast.success('Formulaire enregistré.');
      list.reload();
      reloadDefinitions();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await formsApi.reset(current.requestType);
      toast.success('Formulaire réinitialisé à sa définition d’origine.');
      setConfirmReset(false);
      list.reload();
      reloadDefinitions();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await formsApi.setActive(current.requestType, !current.isActive);
      toast.success(
        current.isActive
          ? 'Formulaire retiré du catalogue : il n’est plus proposé aux employés.'
          : 'Formulaire remis à disposition des employés.',
      );
      setConfirmToggle(false);
      list.reload();
      reloadDefinitions();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (list.loading && definitions.length === 0) {
    return (
      <>
        <PageHeader title="Gestion des formulaires" />
        <LoadingBlock />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Gestion des formulaires"
        subtitle="Champs, libellés, options et disponibilité des 6 formulaires numérisés"
      />

      {list.error && <Alert variant="danger">{list.error}</Alert>}

      <div className="forms-manager">
        {/* Catalogue des formulaires */}
        <Card noPadding className="forms-manager-list">
          <div className="forms-list">
            {definitions.map((definition) => (
              <button
                key={definition.requestType}
                type="button"
                className={`forms-list-item ${
                  definition.requestType === selected ? 'active' : ''
                }`}
                onClick={() => setSelected(definition.requestType)}
              >
                <div className="forms-list-item-head">
                  <Badge color={REQUEST_TYPE_COLORS[definition.requestType]}>
                    {definition.shortLabel || REQUEST_TYPE_LABELS[definition.requestType]}
                  </Badge>
                  {!definition.isActive && <Badge color="slate">Retiré</Badge>}
                </div>
                <div className="forms-list-item-title">{definition.title}</div>
                <div className="text-small text-muted">
                  {definition.fields.length} champ(s) · v{definition.version}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Édition du formulaire sélectionné */}
        <div className="forms-manager-editor">
          {current && draft && (
            <>
              <Card
                title="Présentation du formulaire"
                subtitle={`Version ${current.version} · dernière modification le ${new Date(
                  current.updatedAt,
                ).toLocaleDateString('fr-FR')}`}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={current.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                      onClick={() => setConfirmToggle(true)}
                    >
                      {current.isActive ? 'Retirer du catalogue' : 'Remettre à disposition'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RotateCcw size={15} />}
                      onClick={() => setConfirmReset(true)}
                    >
                      Réinitialiser
                    </Button>
                  </>
                }
              >
                {!current.isActive && (
                  <Alert variant="warning">
                    Ce formulaire est retiré du catalogue : les employés ne peuvent plus le
                    soumettre. Les demandes déjà déposées restent consultables et traitables.
                  </Alert>
                )}

                <div className="form-grid">
                  <FormField label="Intitulé complet" required>
                    <Input
                      value={draft.title ?? ''}
                      onChange={(event) => setDraftValue('title', event.target.value)}
                      maxLength={160}
                    />
                  </FormField>
                  <FormField label="Libellé court" hint="Utilisé dans les badges et les tableaux.">
                    <Input
                      value={draft.shortLabel ?? ''}
                      onChange={(event) => setDraftValue('shortLabel', event.target.value)}
                      maxLength={60}
                    />
                  </FormField>
                  <FormField
                    label="Présentation affichée à l’employé"
                    className="full-width"
                    hint="Texte de la carte de choix du formulaire."
                  >
                    <Textarea
                      rows={2}
                      value={draft.description ?? ''}
                      onChange={(event) => setDraftValue('description', event.target.value)}
                      maxLength={400}
                    />
                  </FormField>
                  <FormField
                    label="Consignes en tête de formulaire"
                    className="full-width"
                    hint="Optionnel : rappel de règle ou précision affichée avant la saisie."
                  >
                    <Textarea
                      rows={2}
                      value={draft.instructions ?? ''}
                      onChange={(event) => setDraftValue('instructions', event.target.value)}
                      maxLength={1000}
                    />
                  </FormField>
                </div>

                <div className="forms-toggles">
                  <label className="forms-toggle">
                    <input
                      type="checkbox"
                      checked={draft.requiresAccessType === true}
                      onChange={(event) =>
                        setDraftValue('requiresAccessType', event.target.checked)
                      }
                    />
                    <span>
                      <strong>Type d’accès Internet</strong>
                      <br />
                      <span className="text-small text-muted">
                        Demander complet / standard / restreint
                      </span>
                    </span>
                  </label>
                  <label className="forms-toggle">
                    <input
                      type="checkbox"
                      checked={draft.requiresDuration === true}
                      onChange={(event) => setDraftValue('requiresDuration', event.target.checked)}
                    />
                    <span>
                      <strong>Durée de l’accès</strong>
                      <br />
                      <span className="text-small text-muted">
                        Sinon la demande est permanente
                      </span>
                    </span>
                  </label>
                  <label className="forms-toggle">
                    <input
                      type="checkbox"
                      checked={draft.requiresJustification === true}
                      onChange={(event) =>
                        setDraftValue('requiresJustification', event.target.checked)
                      }
                    />
                    <span>
                      <strong>Justification libre</strong>
                      <br />
                      <span className="text-small text-muted">
                        Motif saisi par l’employé
                      </span>
                    </span>
                  </label>
                </div>

                {draft.requiresJustification === false && (
                  <FormField
                    label="Justification enregistrée d’office"
                    required
                    hint="Reprise dans le PDF, l’historique et le score d’aide à la décision."
                  >
                    <Textarea
                      rows={2}
                      value={draft.defaultJustification ?? ''}
                      onChange={(event) =>
                        setDraftValue('defaultJustification', event.target.value)
                      }
                      maxLength={500}
                    />
                  </FormField>
                )}
              </Card>

              <Card
                title="Champs spécifiques"
                subtitle="L’ordre d’affichage correspond à l’ordre de la liste"
                actions={
                  <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={addField}>
                    Ajouter un champ
                  </Button>
                }
              >
                {fields.length === 0 && (
                  <p className="text-muted text-small">
                    Ce formulaire n’a aucun champ spécifique : seuls les blocs communs (identité,
                    durée, justification) sont demandés.
                  </p>
                )}

                {fields.map((field, index) => {
                  const used = usage?.byField?.[field.key] ?? 0;
                  return (
                    <div key={field.uid} className="form-field-editor">
                      <div className="form-field-editor-head">
                        <div className="flex-row" style={{ gap: 8, alignItems: 'center' }}>
                          <strong>Champ {index + 1}</strong>
                          <Badge color="slate">{FORM_FIELD_KIND_LABELS[field.kind]}</Badge>
                          {used > 0 && (
                            <span className="text-small text-muted">
                              utilisé par {used} demande(s)
                            </span>
                          )}
                        </div>
                        <div className="flex-row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Monter"
                            icon={<ArrowUp size={14} />}
                            onClick={() => moveField(index, -1)}
                            disabled={index === 0}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Descendre"
                            icon={<ArrowDown size={14} />}
                            onClick={() => moveField(index, 1)}
                            disabled={index === fields.length - 1}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Supprimer ce champ"
                            icon={<Trash2 size={14} />}
                            onClick={() => removeField(field.uid)}
                          />
                        </div>
                      </div>

                      <div className="form-grid">
                        <FormField
                          label="Clé technique"
                          required
                          hint={
                            used > 0
                              ? 'Modifier cette clé rendra les valeurs déjà saisies illisibles pour les nouvelles demandes.'
                              : 'Lettres, chiffres et underscores.'
                          }
                        >
                          <Input
                            value={field.key}
                            onChange={(event) =>
                              updateField(field.uid, { key: event.target.value })
                            }
                            placeholder="ex : targetResource"
                          />
                        </FormField>
                        <FormField label="Type de champ" required>
                          <Select
                            value={field.kind}
                            onChange={(event) =>
                              updateField(field.uid, {
                                kind: event.target.value as FormFieldKind,
                                options:
                                  event.target.value === FormFieldKind.SELECT
                                    ? (field.options ?? [])
                                    : [],
                                required:
                                  event.target.value === FormFieldKind.COMMITMENT
                                    ? true
                                    : field.required,
                              })
                            }
                          >
                            {FORM_FIELD_KIND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField
                          label={
                            field.kind === FormFieldKind.COMMITMENT
                              ? 'Texte de l’engagement'
                              : 'Libellé affiché'
                          }
                          required
                          className="full-width"
                        >
                          <Textarea
                            rows={field.kind === FormFieldKind.COMMITMENT ? 3 : 1}
                            value={field.label}
                            onChange={(event) =>
                              updateField(field.uid, { label: event.target.value })
                            }
                            maxLength={400}
                          />
                        </FormField>

                        {field.kind !== FormFieldKind.COMMITMENT && (
                          <>
                            <FormField label="Aide sous le champ">
                              <Input
                                value={field.helpText ?? ''}
                                onChange={(event) =>
                                  updateField(field.uid, { helpText: event.target.value })
                                }
                                maxLength={300}
                              />
                            </FormField>
                            <FormField label="Texte d’exemple (placeholder)">
                              <Input
                                value={field.placeholder ?? ''}
                                onChange={(event) =>
                                  updateField(field.uid, { placeholder: event.target.value })
                                }
                                maxLength={200}
                              />
                            </FormField>
                          </>
                        )}

                        {KIND_WITH_LENGTH.includes(field.kind) && (
                          <FormField label="Longueur maximale">
                            <Input
                              type="number"
                              min={1}
                              max={5000}
                              value={field.maxLength ?? ''}
                              onChange={(event) =>
                                updateField(field.uid, {
                                  maxLength: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                })
                              }
                            />
                          </FormField>
                        )}

                        {field.kind === FormFieldKind.NUMBER && (
                          <>
                            <FormField label="Valeur minimale">
                              <Input
                                type="number"
                                value={field.min ?? ''}
                                onChange={(event) =>
                                  updateField(field.uid, {
                                    min: event.target.value ? Number(event.target.value) : undefined,
                                  })
                                }
                              />
                            </FormField>
                            <FormField label="Valeur maximale">
                              <Input
                                type="number"
                                value={field.max ?? ''}
                                onChange={(event) =>
                                  updateField(field.uid, {
                                    max: event.target.value ? Number(event.target.value) : undefined,
                                  })
                                }
                              />
                            </FormField>
                          </>
                        )}
                      </div>

                      {field.kind === FormFieldKind.COMMITMENT ? (
                        <div className="text-small text-muted">
                          Un engagement est toujours obligatoire : l’employé doit le cocher pour
                          soumettre le formulaire.
                        </div>
                      ) : (
                        <label className="forms-toggle" style={{ marginTop: 4 }}>
                          <input
                            type="checkbox"
                            checked={field.required === true}
                            onChange={(event) =>
                              updateField(field.uid, { required: event.target.checked })
                            }
                          />
                          <span>Champ obligatoire</span>
                        </label>
                      )}

                      {field.kind === FormFieldKind.SELECT && (
                        <OptionsEditor
                          options={field.options ?? []}
                          onChange={(options) => updateField(field.uid, { options })}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="flex-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFields(toEditable(current));
                      toast.info('Modifications annulées.');
                    }}
                    disabled={saving}
                  >
                    Annuler les modifications
                  </Button>
                  <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>
                    Enregistrer le formulaire
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser le formulaire"
        message={
          <>
            Le formulaire « {current?.title} » retrouvera sa définition d’origine (champs, options et
            consignes livrés avec l’application). Les demandes déjà déposées ne sont pas modifiées.
          </>
        }
        confirmLabel="Réinitialiser"
        variant="danger"
        loading={saving}
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmDialog
        open={confirmToggle}
        title={current?.isActive ? 'Retirer du catalogue' : 'Remettre à disposition'}
        message={
          current?.isActive ? (
            <>
              <AlertTriangle size={15} style={{ verticalAlign: 'middle' }} /> Les employés ne
              pourront plus soumettre « {current?.title} ». Les demandes en cours poursuivent
              normalement leur traitement.
            </>
          ) : (
            <>Le formulaire « {current?.title} » sera de nouveau proposé aux employés.</>
          )
        }
        confirmLabel={current?.isActive ? 'Retirer' : 'Remettre'}
        variant={current?.isActive ? 'danger' : 'primary'}
        loading={saving}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirmToggle(false)}
      />
    </>
  );
}

/** Édition des valeurs autorisées d'une liste de choix */
function OptionsEditor({
  options,
  onChange,
}: {
  options: { value: string; label: string }[];
  onChange: (options: { value: string; label: string }[]) => void;
}) {
  const update = (index: number, patch: Partial<{ value: string; label: string }>) =>
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));

  return (
    <div className="options-editor">
      <div className="text-small" style={{ fontWeight: 600, marginBottom: 6 }}>
        Valeurs autorisées
      </div>
      {options.map((option, index) => (
        <div key={index} className="options-editor-row">
          <Input
            value={option.value}
            onChange={(event) => update(index, { value: event.target.value })}
            placeholder="VALEUR_TECHNIQUE"
          />
          <Input
            value={option.label}
            onChange={(event) => update(index, { label: event.target.value })}
            placeholder="Libellé affiché"
          />
          <Button
            size="sm"
            variant="ghost"
            title="Retirer l’option"
            icon={<Trash2 size={14} />}
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus size={14} />}
        onClick={() => onChange([...options, { value: '', label: '' }])}
      >
        Ajouter une option
      </Button>
    </div>
  );
}

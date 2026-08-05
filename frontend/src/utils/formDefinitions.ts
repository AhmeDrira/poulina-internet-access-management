import { FormDefinition, FormFieldDefinition, FormFieldKind } from '../types';
import { formatDate } from './date';

/**
 * Helpers purs de manipulation des définitions de formulaires.
 *
 * Les définitions ne sont plus codées en dur ici : elles proviennent de l'API
 * (`/form-definitions`, gérées par le super administrateur) et sont mises à
 * disposition des composants par `FormDefinitionsContext`.
 */

/** Champs de saisie hors engagements (rendus séparément) */
export function inputFields(definition?: FormDefinition | null): FormFieldDefinition[] {
  return (definition?.fields ?? []).filter((field) => field.kind !== FormFieldKind.COMMITMENT);
}

/** Engagements à cocher du formulaire */
export function commitmentFields(definition?: FormDefinition | null): FormFieldDefinition[] {
  return (definition?.fields ?? []).filter((field) => field.kind === FormFieldKind.COMMITMENT);
}

/** Libellé lisible d'une valeur saisie (résout les listes, engagements et dates) */
export function formatFieldValue(field: FormFieldDefinition, value: unknown): string {
  if (field.kind === FormFieldKind.COMMITMENT) {
    return value === true ? 'Oui — engagement accepté' : 'Non';
  }
  if (field.kind === FormFieldKind.SELECT && typeof value === 'string') {
    return field.options.find((option) => option.value === value)?.label ?? value;
  }
  if (field.kind === FormFieldKind.DATE && typeof value === 'string') {
    return formatDate(value);
  }
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export interface DescribedEntry {
  label: string;
  value: string;
}

export interface DescribedCommitment {
  label: string;
  accepted: boolean;
}

/**
 * Restitue le contenu rempli d'une demande.
 * Les clés absentes de la définition courante (champ retiré depuis le dépôt de
 * la demande) restent affichées : rien n'est perdu pour les demandes anciennes.
 */
export function describeFormData(
  definition: FormDefinition | null | undefined,
  formData: Record<string, unknown> | undefined,
): { entries: DescribedEntry[]; commitments: DescribedCommitment[] } {
  const data = formData ?? {};
  const entries: DescribedEntry[] = [];
  const commitments: DescribedCommitment[] = [];
  const covered = new Set<string>();

  for (const field of definition?.fields ?? []) {
    covered.add(field.key);
    if (field.kind === FormFieldKind.COMMITMENT) {
      commitments.push({ label: field.label, accepted: data[field.key] === true });
      continue;
    }
    const value = data[field.key];
    if (value === undefined || value === null || value === '') continue;
    entries.push({ label: field.label, value: formatFieldValue(field, value) });
  }

  for (const [key, value] of Object.entries(data)) {
    if (covered.has(key) || value === undefined || value === null || value === '') continue;
    entries.push({
      label: `${key} (champ retiré du formulaire)`,
      value: typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value),
    });
  }

  return { entries, commitments };
}

/** Validation côté saisie, alignée sur les règles du serveur */
export function validateFieldValue(
  field: FormFieldDefinition,
  value: unknown,
): string | null {
  if (field.kind === FormFieldKind.COMMITMENT) {
    return field.required && value !== true
      ? 'Vous devez accepter cet engagement pour soumettre la demande.'
      : null;
  }

  if (field.kind === FormFieldKind.NUMBER) {
    const text = typeof value === 'number' ? String(value) : ((value as string) ?? '').trim();
    if (!text) {
      return field.required ? 'Ce champ est obligatoire.' : null;
    }
    const numeric = Number(text);
    if (Number.isNaN(numeric)) return 'Saisissez un nombre valide.';
    if (field.min !== null && numeric < field.min) {
      return `La valeur ne peut pas être inférieure à ${field.min}.`;
    }
    if (field.max !== null && numeric > field.max) {
      return `La valeur ne peut pas dépasser ${field.max}.`;
    }
    return null;
  }

  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return field.required ? 'Ce champ est obligatoire.' : null;
  }
  if (field.kind === FormFieldKind.DATE && Number.isNaN(new Date(text).getTime())) {
    return 'Saisissez une date valide.';
  }
  if (field.maxLength && text.length > field.maxLength) {
    return `Ce champ ne peut pas dépasser ${field.maxLength} caractères.`;
  }
  return null;
}

/**
 * Nature d'un champ de formulaire (les formulaires sont éditables en base
 * par le super administrateur — voir le module form-definitions).
 */
export enum FormFieldKind {
  /** Saisie libre sur une ligne */
  TEXT = 'text',
  /** Saisie libre sur plusieurs lignes */
  TEXTAREA = 'textarea',
  /** Valeur numérique (bornes optionnelles) */
  NUMBER = 'number',
  /** Date (format ISO AAAA-MM-JJ) */
  DATE = 'date',
  /** Liste de valeurs autorisées */
  SELECT = 'select',
  /** Engagement à cocher obligatoirement (case à cocher d'un formulaire papier) */
  COMMITMENT = 'commitment',
}

export const FORM_FIELD_KIND_LABELS: Record<FormFieldKind, string> = {
  [FormFieldKind.TEXT]: 'Texte court',
  [FormFieldKind.TEXTAREA]: 'Texte long',
  [FormFieldKind.NUMBER]: 'Nombre',
  [FormFieldKind.DATE]: 'Date',
  [FormFieldKind.SELECT]: 'Liste de choix',
  [FormFieldKind.COMMITMENT]: 'Engagement à cocher',
};

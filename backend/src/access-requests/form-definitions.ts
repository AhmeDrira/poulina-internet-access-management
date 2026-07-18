import { RequestType } from '../common/enums';

/**
 * Définition des champs SPÉCIFIQUES à chaque type de formulaire.
 * Source de vérité unique côté serveur : utilisée pour
 *  - valider le contenu de `formData` à la création / re-soumission ;
 *  - libeller les champs dans le PDF généré.
 * Les champs communs (identité, département, durée, justification)
 * sont portés directement par le schéma AccessRequest.
 */
export interface FormFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  kind: 'text' | 'select' | 'commitment';
  /** Valeurs autorisées (kind = select) : value -> libellé */
  options?: Record<string, string>;
  maxLength?: number;
}

export const FORM_DEFINITIONS: Record<RequestType, FormFieldDefinition[]> = {
  [RequestType.INTERNET_ACCESS]: [
    // Le type d'accès (complet / standard / restreint) est porté par le champ accessType
  ],

  [RequestType.REMOTE_ACCESS]: [
    {
      key: 'connectionMethod',
      label: 'Méthode de connexion',
      required: true,
      kind: 'select',
      options: {
        VPN: 'VPN du groupe',
        TEAMVIEWER: 'TeamViewer',
        ANYDESK: 'AnyDesk',
        OTHER: 'Autre (préciser en justification)',
      },
    },
    {
      key: 'targetResource',
      label: 'Serveur, poste ou application cible',
      required: true,
      kind: 'text',
      maxLength: 200,
    },
    {
      key: 'remoteLocation',
      label: 'Lieu de connexion',
      required: true,
      kind: 'select',
      options: {
        HOME: 'Domicile (télétravail)',
        TRAVEL: 'Déplacement professionnel',
        OTHER_SITE: 'Autre site du groupe',
      },
    },
    {
      key: 'workstationId',
      label: 'Poste utilisé (nom ou n° d’inventaire)',
      required: false,
      kind: 'text',
      maxLength: 100,
    },
  ],

  [RequestType.EXTERNAL_DRIVE]: [
    {
      key: 'deviceType',
      label: 'Type de périphérique',
      required: true,
      kind: 'select',
      options: {
        USB_KEY: 'Clé USB',
        EXTERNAL_HDD: 'Disque dur externe',
        CD_DVD: 'CD / DVD',
        SD_CARD: 'Carte mémoire (SD)',
      },
    },
    {
      key: 'workstationId',
      label: 'Poste concerné (nom ou n° d’inventaire)',
      required: true,
      kind: 'text',
      maxLength: 100,
    },
    {
      key: 'dataDescription',
      label: 'Nature des données à transférer',
      required: true,
      kind: 'text',
      maxLength: 300,
    },
    {
      key: 'commitmentAccepted',
      label:
        'Engagement : usage strictement professionnel, analyse antivirus systématique et aucune extraction de données confidentielles',
      required: true,
      kind: 'commitment',
    },
  ],

  [RequestType.NETWORK_SHARE]: [
    {
      key: 'sharePath',
      label: 'Chemin ou nom du partage (ex : \\\\srv-fichiers\\compta)',
      required: true,
      kind: 'text',
      maxLength: 300,
    },
    {
      key: 'permissionLevel',
      label: 'Niveau d’accès demandé',
      required: true,
      kind: 'select',
      options: {
        READ_ONLY: 'Lecture seule',
        READ_WRITE: 'Lecture et écriture',
      },
    },
    {
      key: 'shareOwnerDepartment',
      label: 'Département propriétaire du partage',
      required: false,
      kind: 'text',
      maxLength: 120,
    },
  ],

  [RequestType.USB_3G_KEY]: [
    {
      key: 'simOperator',
      label: 'Opérateur souhaité',
      required: true,
      kind: 'select',
      options: {
        OOREDOO: 'Ooredoo',
        ORANGE: 'Orange',
        TUNISIE_TELECOM: 'Tunisie Télécom',
      },
    },
    {
      key: 'workstationId',
      label: 'PC portable / poste concerné',
      required: true,
      kind: 'text',
      maxLength: 100,
    },
    {
      key: 'usageLocation',
      label: 'Lieu d’utilisation (déplacements, site distant...)',
      required: true,
      kind: 'text',
      maxLength: 200,
    },
  ],

  [RequestType.PASSWORD_COMMITMENT]: [
    {
      key: 'systemsConcerned',
      label: 'Systèmes et applications concernés (session Windows, ERP, messagerie...)',
      required: true,
      kind: 'text',
      maxLength: 300,
    },
    {
      key: 'commitmentAccepted',
      label:
        'Engagement : garder mon mot de passe strictement confidentiel, ne jamais le communiquer, le changer périodiquement et signaler immédiatement toute compromission',
      required: true,
      kind: 'commitment',
    },
  ],
};

export interface FormDataValidationError {
  field: string;
  message: string;
}

/**
 * Valide et nettoie le formData d'une demande selon son type :
 * champs requis présents, valeurs de listes autorisées, engagements cochés,
 * et suppression de toute clé non déclarée (liste blanche).
 */
export function validateFormData(
  requestType: RequestType,
  raw: Record<string, unknown> | undefined | null,
): { cleaned: Record<string, unknown>; errors: FormDataValidationError[] } {
  const definitions = FORM_DEFINITIONS[requestType];
  const input = raw ?? {};
  const cleaned: Record<string, unknown> = {};
  const errors: FormDataValidationError[] = [];

  for (const field of definitions) {
    const value = input[field.key];

    if (field.kind === 'commitment') {
      if (value !== true && field.required) {
        errors.push({
          field: field.key,
          message: `L'engagement doit être accepté : « ${field.label} ».`,
        });
      } else {
        cleaned[field.key] = value === true;
      }
      continue;
    }

    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      if (field.required) {
        errors.push({ field: field.key, message: `Le champ « ${field.label} » est obligatoire.` });
      }
      continue;
    }
    if (field.maxLength && text.length > field.maxLength) {
      errors.push({
        field: field.key,
        message: `Le champ « ${field.label} » dépasse ${field.maxLength} caractères.`,
      });
      continue;
    }
    if (field.kind === 'select' && field.options && !(text in field.options)) {
      errors.push({
        field: field.key,
        message: `Valeur invalide pour « ${field.label} ».`,
      });
      continue;
    }
    cleaned[field.key] = text;
  }

  return { cleaned, errors };
}

/** Libellé lisible d'une valeur de formData (résout les options de listes) */
export function formatFormValue(
  requestType: RequestType,
  key: string,
  value: unknown,
): string {
  const field = FORM_DEFINITIONS[requestType].find((definition) => definition.key === key);
  if (!field) return String(value ?? '');
  if (field.kind === 'commitment') return value === true ? 'Oui — engagement accepté' : 'Non';
  if (field.kind === 'select' && field.options && typeof value === 'string') {
    return field.options[value] ?? value;
  }
  return String(value ?? '');
}

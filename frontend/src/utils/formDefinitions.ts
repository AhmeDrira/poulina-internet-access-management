import { RequestType } from '../types';

/**
 * Miroir frontend des définitions de champs spécifiques par formulaire
 * (backend : src/access-requests/form-definitions.ts).
 * Utilisé pour générer dynamiquement le formulaire de saisie
 * et pour afficher les champs remplis sur la page de détail.
 */
export interface FormFieldDef {
  key: string;
  label: string;
  required: boolean;
  kind: 'text' | 'select' | 'commitment';
  options?: { value: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
}

export const FORM_FIELDS: Record<RequestType, FormFieldDef[]> = {
  [RequestType.INTERNET_ACCESS]: [],

  [RequestType.REMOTE_ACCESS]: [
    {
      key: 'connectionMethod',
      label: 'Méthode de connexion',
      required: true,
      kind: 'select',
      options: [
        { value: 'VPN', label: 'VPN du groupe' },
        { value: 'TEAMVIEWER', label: 'TeamViewer' },
        { value: 'ANYDESK', label: 'AnyDesk' },
        { value: 'OTHER', label: 'Autre (préciser en justification)' },
      ],
    },
    {
      key: 'targetResource',
      label: 'Serveur, poste ou application cible',
      required: true,
      kind: 'text',
      placeholder: 'Ex : srv-erp-01, application de gestion des stocks...',
      maxLength: 200,
    },
    {
      key: 'remoteLocation',
      label: 'Lieu de connexion',
      required: true,
      kind: 'select',
      options: [
        { value: 'HOME', label: 'Domicile (télétravail)' },
        { value: 'TRAVEL', label: 'Déplacement professionnel' },
        { value: 'OTHER_SITE', label: 'Autre site du groupe' },
      ],
    },
    {
      key: 'workstationId',
      label: 'Poste utilisé (nom ou n° d’inventaire)',
      required: false,
      kind: 'text',
      placeholder: 'Ex : PC-IT-042',
      maxLength: 100,
    },
  ],

  [RequestType.EXTERNAL_DRIVE]: [
    {
      key: 'deviceType',
      label: 'Type de périphérique',
      required: true,
      kind: 'select',
      options: [
        { value: 'USB_KEY', label: 'Clé USB' },
        { value: 'EXTERNAL_HDD', label: 'Disque dur externe' },
        { value: 'CD_DVD', label: 'CD / DVD' },
        { value: 'SD_CARD', label: 'Carte mémoire (SD)' },
      ],
    },
    {
      key: 'workstationId',
      label: 'Poste concerné (nom ou n° d’inventaire)',
      required: true,
      kind: 'text',
      placeholder: 'Ex : PC-FIN-011',
      maxLength: 100,
    },
    {
      key: 'dataDescription',
      label: 'Nature des données à transférer',
      required: true,
      kind: 'text',
      placeholder: 'Ex : balances comptables mensuelles (fichiers Excel)',
      maxLength: 300,
    },
    {
      key: 'commitmentAccepted',
      label:
        'Je m’engage à un usage strictement professionnel du périphérique, à effectuer une analyse antivirus systématique et à ne procéder à aucune extraction de données confidentielles.',
      required: true,
      kind: 'commitment',
    },
  ],

  [RequestType.NETWORK_SHARE]: [
    {
      key: 'sharePath',
      label: 'Chemin ou nom du partage',
      required: true,
      kind: 'text',
      placeholder: 'Ex : \\\\srv-fichiers\\compta',
      maxLength: 300,
    },
    {
      key: 'permissionLevel',
      label: 'Niveau d’accès demandé',
      required: true,
      kind: 'select',
      options: [
        { value: 'READ_ONLY', label: 'Lecture seule' },
        { value: 'READ_WRITE', label: 'Lecture et écriture' },
      ],
    },
    {
      key: 'shareOwnerDepartment',
      label: 'Département propriétaire du partage',
      required: false,
      kind: 'text',
      placeholder: 'Ex : Ressources Humaines',
      maxLength: 120,
    },
  ],

  [RequestType.USB_3G_KEY]: [
    {
      key: 'simOperator',
      label: 'Opérateur souhaité',
      required: true,
      kind: 'select',
      options: [
        { value: 'OOREDOO', label: 'Ooredoo' },
        { value: 'ORANGE', label: 'Orange' },
        { value: 'TUNISIE_TELECOM', label: 'Tunisie Télécom' },
      ],
    },
    {
      key: 'workstationId',
      label: 'PC portable / poste concerné',
      required: true,
      kind: 'text',
      placeholder: 'Ex : LT-MKT-007',
      maxLength: 100,
    },
    {
      key: 'usageLocation',
      label: 'Lieu d’utilisation',
      required: true,
      kind: 'text',
      placeholder: 'Ex : salons professionnels, visites des filiales...',
      maxLength: 200,
    },
  ],

  [RequestType.PASSWORD_COMMITMENT]: [
    {
      key: 'systemsConcerned',
      label: 'Systèmes et applications concernés',
      required: true,
      kind: 'text',
      placeholder: 'Ex : session Windows, messagerie, ERP du groupe',
      maxLength: 300,
    },
    {
      key: 'commitmentAccepted',
      label:
        'Je m’engage à garder mon mot de passe strictement confidentiel, à ne jamais le communiquer (y compris au service informatique), à le changer périodiquement et à signaler immédiatement toute compromission.',
      required: true,
      kind: 'commitment',
    },
  ],
};

/** Le formulaire a-t-il un champ durée ? (la fiche d'engagement est toujours permanente) */
export function hasDurationFields(type: RequestType): boolean {
  return type !== RequestType.PASSWORD_COMMITMENT;
}

/** La justification libre est-elle demandée ? */
export function hasJustification(type: RequestType): boolean {
  return type !== RequestType.PASSWORD_COMMITMENT;
}

/** Libellé lisible d'une valeur de formData (résout les listes et les engagements) */
export function formatFormValue(type: RequestType, key: string, value: unknown): string {
  const field = FORM_FIELDS[type].find((definition) => definition.key === key);
  if (!field) return String(value ?? '—');
  if (field.kind === 'commitment') return value === true ? 'Oui — engagement accepté' : 'Non';
  if (field.kind === 'select' && field.options && typeof value === 'string') {
    return field.options.find((option) => option.value === value)?.label ?? value;
  }
  return String(value ?? '—');
}

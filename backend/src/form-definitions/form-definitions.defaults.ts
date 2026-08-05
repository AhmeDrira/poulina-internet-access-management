import { FormFieldKind, RequestType } from '../common/enums';

/**
 * Définitions PAR DÉFAUT des 6 formulaires numérisés.
 *
 * Ce fichier n'est plus la source de vérité à l'exécution : les formulaires sont
 * stockés en base (collection `formdefinitions`) et modifiables par le super
 * administrateur. Ces valeurs servent :
 *  - à créer les définitions manquantes au démarrage et au seed ;
 *  - à réinitialiser un formulaire à son état d'origine.
 */
export interface DefaultFormFieldOption {
  value: string;
  label: string;
}

export interface DefaultFormField {
  key: string;
  label: string;
  kind: FormFieldKind;
  required: boolean;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  placeholder?: string;
  helpText?: string;
  options?: DefaultFormFieldOption[];
}

export interface DefaultFormDefinition {
  requestType: RequestType;
  /** Intitulé complet du formulaire (titre de la page et du PDF) */
  title: string;
  /** Libellé court (badges, filtres, colonnes de tableau) */
  shortLabel: string;
  /** Présentation affichée à l'employé sur la carte de choix du formulaire */
  description: string;
  /** Consignes affichées en tête du formulaire (optionnel) */
  instructions: string;
  /** Le type d'accès Internet (complet / standard / restreint) est-il demandé ? */
  requiresAccessType: boolean;
  /** Le formulaire porte-t-il une durée d'accès ? */
  requiresDuration: boolean;
  /** L'employé doit-il saisir une justification libre ? */
  requiresJustification: boolean;
  /** Justification enregistrée d'office quand le formulaire n'en demande pas */
  defaultJustification: string;
  fields: DefaultFormField[];
}

export const DEFAULT_FORM_DEFINITIONS: Record<RequestType, DefaultFormDefinition> = {
  [RequestType.INTERNET_ACCESS]: {
    requestType: RequestType.INTERNET_ACCESS,
    title: "Demande d'accès Internet",
    shortLabel: 'Accès Internet',
    description:
      'Accès Internet depuis votre poste de travail : complet, standard ou restreint selon le besoin du poste.',
    instructions: '',
    requiresAccessType: true,
    requiresDuration: true,
    requiresJustification: true,
    defaultJustification: '',
    // Le niveau d'accès (complet / standard / restreint) est porté par le champ accessType
    fields: [],
  },

  [RequestType.REMOTE_ACCESS]: {
    requestType: RequestType.REMOTE_ACCESS,
    title: "Demande d'accès à distance",
    shortLabel: 'Accès à distance',
    description:
      'Connexion à distance au réseau du groupe (VPN, télémaintenance) depuis le domicile ou en déplacement.',
    instructions: '',
    requiresAccessType: false,
    requiresDuration: true,
    requiresJustification: true,
    defaultJustification: '',
    fields: [
      {
        key: 'connectionMethod',
        label: 'Méthode de connexion',
        kind: FormFieldKind.SELECT,
        required: true,
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
        kind: FormFieldKind.TEXT,
        required: true,
        maxLength: 200,
        placeholder: 'Ex : srv-erp-01, application de gestion des stocks...',
      },
      {
        key: 'remoteLocation',
        label: 'Lieu de connexion',
        kind: FormFieldKind.SELECT,
        required: true,
        options: [
          { value: 'HOME', label: 'Domicile (télétravail)' },
          { value: 'TRAVEL', label: 'Déplacement professionnel' },
          { value: 'OTHER_SITE', label: 'Autre site du groupe' },
        ],
      },
      {
        key: 'workstationId',
        label: 'Poste utilisé (nom ou n° d’inventaire)',
        kind: FormFieldKind.TEXT,
        required: false,
        maxLength: 100,
        placeholder: 'Ex : PC-IT-042',
      },
    ],
  },

  [RequestType.EXTERNAL_DRIVE]: {
    requestType: RequestType.EXTERNAL_DRIVE,
    title: "Engagement pour déverrouillage d'un lecteur externe",
    shortLabel: 'Lecteur externe',
    description:
      'Déverrouillage temporaire des ports USB / lecteurs externes, avec engagement d’usage professionnel.',
    instructions:
      'Le déverrouillage est accordé pour une durée limitée et tracé dans le journal de sécurité.',
    requiresAccessType: false,
    requiresDuration: true,
    requiresJustification: true,
    defaultJustification: '',
    fields: [
      {
        key: 'deviceType',
        label: 'Type de périphérique',
        kind: FormFieldKind.SELECT,
        required: true,
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
        kind: FormFieldKind.TEXT,
        required: true,
        maxLength: 100,
        placeholder: 'Ex : PC-FIN-011',
      },
      {
        key: 'dataDescription',
        label: 'Nature des données à transférer',
        kind: FormFieldKind.TEXTAREA,
        required: true,
        maxLength: 300,
        placeholder: 'Ex : balances comptables mensuelles (fichiers Excel)',
      },
      {
        key: 'commitmentAccepted',
        label:
          'Je m’engage à un usage strictement professionnel du périphérique, à effectuer une analyse antivirus systématique et à ne procéder à aucune extraction de données confidentielles.',
        kind: FormFieldKind.COMMITMENT,
        required: true,
      },
    ],
  },

  [RequestType.NETWORK_SHARE]: {
    requestType: RequestType.NETWORK_SHARE,
    title: "Demande d'accès à un partage réseau",
    shortLabel: 'Partage réseau',
    description:
      'Accès à un dossier partagé du réseau, en lecture seule ou en lecture-écriture.',
    instructions: '',
    requiresAccessType: false,
    requiresDuration: true,
    requiresJustification: true,
    defaultJustification: '',
    fields: [
      {
        key: 'sharePath',
        label: 'Chemin ou nom du partage',
        kind: FormFieldKind.TEXT,
        required: true,
        maxLength: 300,
        placeholder: 'Ex : \\\\srv-fichiers\\compta',
      },
      {
        key: 'permissionLevel',
        label: 'Niveau d’accès demandé',
        kind: FormFieldKind.SELECT,
        required: true,
        options: [
          { value: 'READ_ONLY', label: 'Lecture seule' },
          { value: 'READ_WRITE', label: 'Lecture et écriture' },
        ],
      },
      {
        key: 'shareOwnerDepartment',
        label: 'Département propriétaire du partage',
        kind: FormFieldKind.TEXT,
        required: false,
        maxLength: 120,
        placeholder: 'Ex : Ressources Humaines',
      },
    ],
  },

  [RequestType.USB_3G_KEY]: {
    requestType: RequestType.USB_3G_KEY,
    title: "Demande d'accès Internet via clé 3G",
    shortLabel: 'Clé 3G',
    description:
      'Attribution d’une clé 3G pour un accès Internet mobile lors des déplacements professionnels.',
    instructions: '',
    requiresAccessType: false,
    requiresDuration: true,
    requiresJustification: true,
    defaultJustification: '',
    fields: [
      {
        key: 'simOperator',
        label: 'Opérateur souhaité',
        kind: FormFieldKind.SELECT,
        required: true,
        options: [
          { value: 'OOREDOO', label: 'Ooredoo' },
          { value: 'ORANGE', label: 'Orange' },
          { value: 'TUNISIE_TELECOM', label: 'Tunisie Télécom' },
        ],
      },
      {
        key: 'workstationId',
        label: 'PC portable / poste concerné',
        kind: FormFieldKind.TEXT,
        required: true,
        maxLength: 100,
        placeholder: 'Ex : LT-MKT-007',
      },
      {
        key: 'usageLocation',
        label: 'Lieu d’utilisation',
        kind: FormFieldKind.TEXT,
        required: true,
        maxLength: 200,
        placeholder: 'Ex : salons professionnels, visites des filiales...',
      },
    ],
  },

  [RequestType.PASSWORD_COMMITMENT]: {
    requestType: RequestType.PASSWORD_COMMITMENT,
    title: 'Fiche d’engagement du mot de passe',
    shortLabel: 'Engagement mot de passe',
    description:
      'Engagement formel de confidentialité et de bonne gestion de votre mot de passe professionnel.',
    instructions:
      'Cette fiche est un engagement permanent : elle ne comporte ni durée ni justification.',
    requiresAccessType: false,
    requiresDuration: false,
    requiresJustification: false,
    defaultJustification:
      'Engagement de confidentialité relatif au mot de passe professionnel.',
    fields: [
      {
        key: 'systemsConcerned',
        label: 'Systèmes et applications concernés',
        kind: FormFieldKind.TEXT,
        required: true,
        maxLength: 300,
        placeholder: 'Ex : session Windows, messagerie, ERP du groupe',
      },
      {
        key: 'commitmentAccepted',
        label:
          'Je m’engage à garder mon mot de passe strictement confidentiel, à ne jamais le communiquer (y compris au service informatique), à le changer périodiquement et à signaler immédiatement toute compromission.',
        kind: FormFieldKind.COMMITMENT,
        required: true,
      },
    ],
  },
};

/**
 * Clés réservées : elles correspondent à des colonnes propres de la demande
 * (identité, durée, justification...) et ne peuvent pas être réutilisées
 * comme champ spécifique de formulaire.
 */
export const RESERVED_FIELD_KEYS = [
  'accessType',
  'durationType',
  'durationDays',
  'justification',
  'position',
  'serviceId',
  'service',
  'department',
  'firstName',
  'lastName',
  'matricule',
  'email',
  'reference',
  'status',
  'requestType',
];

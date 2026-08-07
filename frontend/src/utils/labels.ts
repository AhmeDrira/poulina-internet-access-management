import {
  AccessType,
  AccountState,
  DurationType,
  FormFieldKind,
  RecommendationLevel,
  RequestKind,
  RequestStatus,
  RequestType,
  Role,
  ThreadStatus,
} from '../types';

export type BadgeColor =
  | 'blue'
  | 'green'
  | 'red'
  | 'amber'
  | 'purple'
  | 'slate'
  | 'cyan'
  | 'orange';

// ---------- Statuts ----------

export const STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.PENDING_MANAGER]: 'En attente du chef',
  [RequestStatus.CHANGES_REQUESTED]: 'Modifications demandées',
  [RequestStatus.REJECTED]: 'Refusée',
  [RequestStatus.APPROVED_BY_MANAGER]: 'Acceptée par le chef',
  [RequestStatus.PENDING_NETWORK]: 'En attente réseau',
  [RequestStatus.IN_PROGRESS_NETWORK]: 'En cours de traitement',
  [RequestStatus.ACTIVATED]: 'Exécutée / activée',
  [RequestStatus.REJECTED_TECHNICAL]: 'Refus technique',
  [RequestStatus.CLOSED]: 'Clôturée',
  [RequestStatus.EXPIRED]: 'Expirée',
};

export const STATUS_COLORS: Record<RequestStatus, BadgeColor> = {
  [RequestStatus.PENDING_MANAGER]: 'amber',
  [RequestStatus.CHANGES_REQUESTED]: 'orange',
  [RequestStatus.REJECTED]: 'red',
  [RequestStatus.APPROVED_BY_MANAGER]: 'blue',
  [RequestStatus.PENDING_NETWORK]: 'cyan',
  [RequestStatus.IN_PROGRESS_NETWORK]: 'purple',
  [RequestStatus.ACTIVATED]: 'green',
  [RequestStatus.REJECTED_TECHNICAL]: 'red',
  [RequestStatus.CLOSED]: 'slate',
  [RequestStatus.EXPIRED]: 'orange',
};

// ---------- Types de formulaires ----------

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.INTERNET_ACCESS]: 'Accès Internet',
  [RequestType.REMOTE_ACCESS]: 'Accès à distance',
  [RequestType.EXTERNAL_DRIVE]: 'Lecteur externe',
  [RequestType.NETWORK_SHARE]: 'Partage réseau',
  [RequestType.USB_3G_KEY]: 'Clé 3G',
  [RequestType.PASSWORD_COMMITMENT]: 'Engagement mot de passe',
};

export const REQUEST_TYPE_FULL_LABELS: Record<RequestType, string> = {
  [RequestType.INTERNET_ACCESS]: "Demande d'accès Internet",
  [RequestType.REMOTE_ACCESS]: "Demande d'accès à distance",
  [RequestType.EXTERNAL_DRIVE]: "Engagement pour déverrouillage d'un lecteur externe",
  [RequestType.NETWORK_SHARE]: "Demande d'accès à un partage réseau",
  [RequestType.USB_3G_KEY]: "Demande d'accès Internet via clé 3G",
  [RequestType.PASSWORD_COMMITMENT]: 'Fiche d’engagement du mot de passe',
};

export const REQUEST_TYPE_DESCRIPTIONS: Record<RequestType, string> = {
  [RequestType.INTERNET_ACCESS]:
    'Accès Internet depuis votre poste de travail : complet, standard ou restreint selon le besoin du poste.',
  [RequestType.REMOTE_ACCESS]:
    'Connexion à distance au réseau du groupe (VPN, télémaintenance) depuis le domicile ou en déplacement.',
  [RequestType.EXTERNAL_DRIVE]:
    'Déverrouillage temporaire des ports USB / lecteurs externes, avec engagement d’usage professionnel.',
  [RequestType.NETWORK_SHARE]:
    'Accès à un dossier partagé du réseau, en lecture seule ou en lecture-écriture.',
  [RequestType.USB_3G_KEY]:
    'Attribution d’une clé 3G pour un accès Internet mobile lors des déplacements professionnels.',
  [RequestType.PASSWORD_COMMITMENT]:
    'Engagement formel de confidentialité et de bonne gestion de votre mot de passe professionnel.',
};

export const REQUEST_TYPE_COLORS: Record<RequestType, BadgeColor> = {
  [RequestType.INTERNET_ACCESS]: 'blue',
  [RequestType.REMOTE_ACCESS]: 'purple',
  [RequestType.EXTERNAL_DRIVE]: 'orange',
  [RequestType.NETWORK_SHARE]: 'cyan',
  [RequestType.USB_3G_KEY]: 'green',
  [RequestType.PASSWORD_COMMITMENT]: 'slate',
};

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  [RequestKind.NEW]: 'Nouvelle demande',
  [RequestKind.RENEWAL]: 'Renouvellement de la demande',
};

export const REQUEST_KIND_OPTIONS = Object.values(RequestKind).map((value) => ({
  value,
  label: REQUEST_KIND_LABELS[value],
}));

// ---------- Rôles ----------

export const ROLE_LABELS: Record<Role, string> = {
  [Role.EMPLOYEE]: 'Employé',
  [Role.MANAGER]: 'Chef de département',
  [Role.NETWORK_TEAM]: 'Équipe réseau',
  [Role.ADMIN]: 'Administrateur',
  [Role.SECURITY_OFFICER]: 'Responsable sécurité',
  [Role.SUPER_ADMIN]: 'Super administrateur',
};

export const ROLE_COLORS: Record<Role, BadgeColor> = {
  [Role.EMPLOYEE]: 'slate',
  [Role.MANAGER]: 'blue',
  [Role.NETWORK_TEAM]: 'purple',
  [Role.ADMIN]: 'red',
  [Role.SECURITY_OFFICER]: 'orange',
  [Role.SUPER_ADMIN]: 'amber',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.EMPLOYEE]: 'Dépose ses demandes et suit leur traitement.',
  [Role.MANAGER]:
    'Valide les demandes de son département et échange avec l’équipe réseau.',
  [Role.NETWORK_TEAM]:
    'Réalise la vérification technique et l’exécution des accès validés.',
  [Role.ADMIN]:
    'Gère les utilisateurs et les référentiels, consulte les statistiques et l’audit.',
  [Role.SECURITY_OFFICER]:
    'Consulte l’ensemble des demandes, les statistiques et le journal d’audit.',
  [Role.SUPER_ADMIN]:
    'Supervise l’application : administrateurs, formulaires, référentiels et audit.',
};

// ---------- Types d'accès ----------

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  [AccessType.FULL]: 'Accès complet',
  [AccessType.STANDARD]: 'Accès standard',
  [AccessType.RESTRICTED]: 'Accès restreint',
};

export const ACCESS_TYPE_DESCRIPTIONS: Record<AccessType, string> = {
  [AccessType.FULL]: 'Navigation sans restriction (profil sensible, réservé aux besoins justifiés)',
  [AccessType.STANDARD]: 'Navigation professionnelle avec filtrage par catégories',
  [AccessType.RESTRICTED]: 'Liste limitée de sites autorisés',
};

export const DURATION_LABELS: Record<DurationType, string> = {
  [DurationType.TEMPORARY]: 'Temporaire',
  [DurationType.PERMANENT]: 'Permanent',
};

// ---------- Aide à la décision ----------

export const RECOMMENDATION_LABELS: Record<RecommendationLevel, string> = {
  [RecommendationLevel.LIKELY_LEGITIMATE]: 'Demande probablement légitime',
  [RecommendationLevel.NEEDS_REVIEW]: 'Demande à vérifier',
  [RecommendationLevel.RISKY]: 'Demande risquée ou insuffisamment justifiée',
};

export const RECOMMENDATION_COLORS: Record<RecommendationLevel, BadgeColor> = {
  [RecommendationLevel.LIKELY_LEGITIMATE]: 'green',
  [RecommendationLevel.NEEDS_REVIEW]: 'amber',
  [RecommendationLevel.RISKY]: 'red',
};

// ---------- Journal d'audit ----------

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Échec de connexion',
  PASSWORD_CHANGED: 'Mot de passe modifié',
  REQUEST_CREATED: 'Demande créée',
  REQUEST_APPROVED: 'Demande acceptée',
  REQUEST_REJECTED: 'Demande refusée',
  REQUEST_CHANGES_REQUESTED: 'Modifications demandées',
  REQUEST_RESUBMITTED: 'Demande re-soumise',
  REQUEST_TAKEN_IN_CHARGE: 'Demande prise en charge',
  REQUEST_PROCESSED: 'Demande traitée',
  REQUEST_REJECTED_TECHNICAL: 'Refus technique',
  REQUEST_CLOSED: 'Demande clôturée',
  REQUEST_EXPIRED: 'Accès expiré',
  REQUEST_PDF_EXPORTED: 'Formulaire exporté en PDF',
  USER_INVITED: 'Compte créé (lien d’activation envoyé)',
  USER_INVITATION_RESENT: 'Lien d’activation régénéré',
  ACCOUNT_ACTIVATED: 'Compte activé par l’employé',
  ACTIVATION_FAILED: 'Lien d’activation invalide ou expiré',
  PASSWORD_RESET_ENFORCED: 'Réinitialisation du mot de passe imposée',
  FORM_UPDATED: 'Formulaire modifié',
  FORM_ACTIVATED: 'Formulaire remis à disposition',
  FORM_DEACTIVATED: 'Formulaire retiré du catalogue',
  FORM_RESET: 'Formulaire réinitialisé',
  MESSAGE_SENT: 'Message interne envoyé',
  THREAD_RESOLVED: 'Échange marqué comme traité',
  THREAD_REOPENED: 'Échange rouvert',
  USER_CREATED: 'Utilisateur créé',
  USER_UPDATED: 'Utilisateur modifié',
  USER_ACTIVATED: 'Utilisateur activé',
  USER_DEACTIVATED: 'Utilisateur désactivé',
  USER_DELETED: 'Utilisateur supprimé',
  ROLE_CHANGED: 'Rôle modifié',
  DEPARTMENT_CREATED: 'Département créé',
  DEPARTMENT_UPDATED: 'Département modifié',
  DEPARTMENT_DELETED: 'Département supprimé',
  SERVICE_CREATED: 'Service créé',
  SERVICE_UPDATED: 'Service modifié',
  SERVICE_DELETED: 'Service supprimé',
};

// ---------- Options pour les formulaires ----------

export const STATUS_OPTIONS = Object.values(RequestStatus).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

export const ROLE_OPTIONS = Object.values(Role).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export const ACCESS_TYPE_OPTIONS = Object.values(AccessType).map((value) => ({
  value,
  label: ACCESS_TYPE_LABELS[value],
}));

export const DURATION_OPTIONS = Object.values(DurationType).map((value) => ({
  value,
  label: DURATION_LABELS[value],
}));

export const REQUEST_TYPE_OPTIONS = Object.values(RequestType).map((value) => ({
  value,
  label: REQUEST_TYPE_LABELS[value],
}));

// ---------- Formulaires et messagerie ----------

export const FORM_FIELD_KIND_LABELS: Record<FormFieldKind, string> = {
  [FormFieldKind.TEXT]: 'Texte court',
  [FormFieldKind.TEXTAREA]: 'Texte long',
  [FormFieldKind.NUMBER]: 'Nombre',
  [FormFieldKind.DATE]: 'Date',
  [FormFieldKind.SELECT]: 'Liste de choix',
  [FormFieldKind.COMMITMENT]: 'Engagement à cocher',
};

export const FORM_FIELD_KIND_OPTIONS = Object.values(FormFieldKind).map((value) => ({
  value,
  label: FORM_FIELD_KIND_LABELS[value],
}));

export const THREAD_STATUS_LABELS: Record<ThreadStatus, string> = {
  [ThreadStatus.OPEN]: 'En cours',
  [ThreadStatus.RESOLVED]: 'Traité',
};

export const THREAD_STATUS_COLORS: Record<ThreadStatus, BadgeColor> = {
  [ThreadStatus.OPEN]: 'amber',
  [ThreadStatus.RESOLVED]: 'green',
};

export const ACCOUNT_STATE_LABELS: Record<AccountState, string> = {
  ACTIVE: 'Actif',
  PENDING_ACTIVATION: 'En attente d’activation',
  DISABLED: 'Désactivé',
};

export const ACCOUNT_STATE_COLORS: Record<AccountState, BadgeColor> = {
  ACTIVE: 'green',
  PENDING_ACTIVATION: 'amber',
  DISABLED: 'slate',
};

export function fullName(user?: { firstName: string; lastName: string } | null): string {
  if (!user) return '—';
  return `${user.firstName} ${user.lastName}`;
}

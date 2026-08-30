export enum AccessType {
  /** Accès complet sans restriction (sensible) */
  FULL = 'FULL',
  /** Navigation professionnelle standard (filtrage par catégories) */
  STANDARD = 'STANDARD',
  /** Accès restreint à une liste de sites autorisés */
  RESTRICTED = 'RESTRICTED',
}

/** Libellés français des types d'accès (PDF, contexte transmis à l'assistance IA) */
export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  [AccessType.FULL]: 'Accès complet',
  [AccessType.STANDARD]: 'Accès standard (navigation professionnelle filtrée)',
  [AccessType.RESTRICTED]: 'Accès restreint (liste blanche de sites)',
};

export enum DurationType {
  /** Accès limité dans le temps (durée en jours obligatoire) */
  TEMPORARY = 'TEMPORARY',
  /** Accès permanent lié au poste */
  PERMANENT = 'PERMANENT',
}

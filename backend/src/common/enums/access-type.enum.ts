export enum AccessType {
  /** Accès complet sans restriction (sensible) */
  FULL = 'FULL',
  /** Navigation professionnelle standard (filtrage par catégories) */
  STANDARD = 'STANDARD',
  /** Accès restreint à une liste de sites autorisés */
  RESTRICTED = 'RESTRICTED',
}

export enum DurationType {
  /** Accès limité dans le temps (durée en jours obligatoire) */
  TEMPORARY = 'TEMPORARY',
  /** Accès permanent lié au poste */
  PERMANENT = 'PERMANENT',
}

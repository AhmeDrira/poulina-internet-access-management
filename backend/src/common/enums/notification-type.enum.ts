export enum NotificationType {
  /** Nouvelle demande soumise (destinée au chef de département) */
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
  /** Demande acceptée par le chef (employé + équipe réseau) */
  REQUEST_APPROVED = 'REQUEST_APPROVED',
  /** Demande refusée par le chef (employé) */
  REQUEST_REJECTED = 'REQUEST_REJECTED',
  /** Le chef demande une modification / des informations complémentaires (employé) */
  REQUEST_CHANGES_REQUESTED = 'REQUEST_CHANGES_REQUESTED',
  /** L'employé a modifié et re-soumis sa demande (chef) */
  REQUEST_RESUBMITTED = 'REQUEST_RESUBMITTED',
  /** Demande prise en charge par l'équipe réseau (employé) */
  REQUEST_IN_PROGRESS = 'REQUEST_IN_PROGRESS',
  /** Accès activé / demande exécutée (employé) */
  REQUEST_ACTIVATED = 'REQUEST_ACTIVATED',
  /** Refus technique par l'équipe réseau (employé) */
  REQUEST_REJECTED_TECHNICAL = 'REQUEST_REJECTED_TECHNICAL',
  /** Demande clôturée (employé) */
  REQUEST_CLOSED = 'REQUEST_CLOSED',
  /** Accès expiré (employé) */
  REQUEST_EXPIRED = 'REQUEST_EXPIRED',
  /** Accès proche de l'expiration (employé) */
  REQUEST_EXPIRING_SOON = 'REQUEST_EXPIRING_SOON',
}

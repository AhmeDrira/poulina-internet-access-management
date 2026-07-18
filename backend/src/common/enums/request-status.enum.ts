export enum RequestStatus {
  /** Demande soumise, en attente de validation du chef de département */
  PENDING_MANAGER = 'PENDING_MANAGER',
  /** Le chef demande une modification ou des informations complémentaires */
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  /** Demande refusée par le chef (motif obligatoire) */
  REJECTED = 'REJECTED',
  /** Demande acceptée par le chef — en attente de l'équipe réseau */
  APPROVED_BY_MANAGER = 'APPROVED_BY_MANAGER',
  /** Synonyme fonctionnel de APPROVED_BY_MANAGER (file d'attente réseau) */
  PENDING_NETWORK = 'PENDING_NETWORK',
  /** Prise en charge par l'équipe réseau et serveur */
  IN_PROGRESS_NETWORK = 'IN_PROGRESS_NETWORK',
  /** Accès activé / demande exécutée techniquement */
  ACTIVATED = 'ACTIVATED',
  /** Refus technique par l'équipe réseau (2e vérification, motif obligatoire) */
  REJECTED_TECHNICAL = 'REJECTED_TECHNICAL',
  /** Demande clôturée (accès terminé et archivé) */
  CLOSED = 'CLOSED',
  /** Accès arrivé à expiration (détecté par la tâche planifiée) */
  EXPIRED = 'EXPIRED',
}

/** Statuts visibles dans la file de l'équipe réseau */
export const NETWORK_QUEUE_STATUSES = [
  RequestStatus.APPROVED_BY_MANAGER,
  RequestStatus.PENDING_NETWORK,
  RequestStatus.IN_PROGRESS_NETWORK,
  RequestStatus.ACTIVATED,
  RequestStatus.REJECTED_TECHNICAL,
  RequestStatus.CLOSED,
  RequestStatus.EXPIRED,
];

/** Statuts dans lesquels l'employé peut encore modifier sa demande */
export const EDITABLE_STATUSES = [RequestStatus.CHANGES_REQUESTED];

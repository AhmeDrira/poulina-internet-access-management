/** État d'un fil de discussion interne rattaché à une demande */
export enum ThreadStatus {
  /** Échange en cours entre le chef de département et l'équipe réseau */
  OPEN = 'OPEN',
  /** Point traité : le fil reste consultable mais sort de la file active */
  RESOLVED = 'RESOLVED',
}

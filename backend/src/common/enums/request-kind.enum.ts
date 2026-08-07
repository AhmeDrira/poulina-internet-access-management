/** Nature administrative de la demande remplie par l'employe. */
export enum RequestKind {
  NEW = 'NEW',
  RENEWAL = 'RENEWAL',
}

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  [RequestKind.NEW]: 'Nouvelle demande',
  [RequestKind.RENEWAL]: 'Renouvellement de la demande',
};

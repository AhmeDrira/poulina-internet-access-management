/**
 * Types de formulaires numérisés (anciens formulaires papier de la DSI Poulina).
 * Chaque type suit le même workflow général (employé → chef → équipe réseau)
 * mais possède ses propres champs spécifiques (voir form-definitions.ts).
 */
export enum RequestType {
  /** Formulaire de demande d'accès Internet */
  INTERNET_ACCESS = 'INTERNET_ACCESS',
  /** Formulaire de demande d'accès à distance (VPN, télémaintenance...) */
  REMOTE_ACCESS = 'REMOTE_ACCESS',
  /** Formulaire d'engagement pour déverrouillage d'un lecteur externe (USB, disque...) */
  EXTERNAL_DRIVE = 'EXTERNAL_DRIVE',
  /** Formulaire de demande d'accès à un partage réseau */
  NETWORK_SHARE = 'NETWORK_SHARE',
  /** Formulaire de demande d'accès Internet via clé 3G */
  USB_3G_KEY = 'USB_3G_KEY',
  /** Fiche d'engagement du mot de passe */
  PASSWORD_COMMITMENT = 'PASSWORD_COMMITMENT',
}

/** Préfixe de référence par type (ex : REQ-NET-2026-0001) */
export const REQUEST_TYPE_PREFIXES: Record<RequestType, string> = {
  [RequestType.INTERNET_ACCESS]: 'NET',
  [RequestType.REMOTE_ACCESS]: 'DIS',
  [RequestType.EXTERNAL_DRIVE]: 'USB',
  [RequestType.NETWORK_SHARE]: 'PRT',
  [RequestType.USB_3G_KEY]: '3G',
  [RequestType.PASSWORD_COMMITMENT]: 'ENG',
};

/** Libellés français (utilisés dans les notifications et le PDF) */
export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.INTERNET_ACCESS]: "Demande d'accès Internet",
  [RequestType.REMOTE_ACCESS]: "Demande d'accès à distance",
  [RequestType.EXTERNAL_DRIVE]: "Engagement pour déverrouillage d'un lecteur externe",
  [RequestType.NETWORK_SHARE]: "Demande d'accès à un partage réseau",
  [RequestType.USB_3G_KEY]: "Demande d'accès Internet via clé 3G",
  [RequestType.PASSWORD_COMMITMENT]: 'Fiche d’engagement du mot de passe',
};

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  NETWORK_TEAM = 'NETWORK_TEAM',
  ADMIN = 'ADMIN',
  SECURITY_OFFICER = 'SECURITY_OFFICER',
  /** Supervise l'application : administrateurs, formulaires et référentiels */
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/**
 * Rôles d'administration (gestion des référentiels et des comptes).
 * Le super administrateur dispose en plus de la gestion des formulaires
 * et des comptes administrateurs (voir PRIVILEGED_ROLES).
 */
export const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

/** Rôles disposant d'une vue globale en lecture (toutes demandes, audit, statistiques) */
export const GLOBAL_READ_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.SECURITY_OFFICER];

/** Rôles dont la création et la modification sont réservées au super administrateur */
export const PRIVILEGED_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

/**
 * Seuls acteurs autorisés à utiliser la messagerie interne de traitement
 * (chef de département ↔ équipe réseau). Volontairement fermée aux autres rôles.
 */
export const MESSAGING_ROLES: Role[] = [Role.MANAGER, Role.NETWORK_TEAM];

/** Rôles pouvant soumettre une demande d'accès pour eux-mêmes */
export const REQUESTER_ROLES: Role[] = [Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM];

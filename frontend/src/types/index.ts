// ---------- Enums (miroir du backend) ----------

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  NETWORK_TEAM = 'NETWORK_TEAM',
  ADMIN = 'ADMIN',
  SECURITY_OFFICER = 'SECURITY_OFFICER',
  /** Supervise l'application : administrateurs, formulaires et référentiels */
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/** Rôles d'administration (référentiels et comptes) */
export const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

/** Rôles disposant d'une vue globale en lecture */
export const GLOBAL_READ_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.SECURITY_OFFICER];

/** Rôles dont la gestion est réservée au super administrateur */
export const PRIVILEGED_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

/** Seuls rôles autorisés à utiliser la messagerie interne de traitement */
export const MESSAGING_ROLES: Role[] = [Role.MANAGER, Role.NETWORK_TEAM];

/** Rôles pouvant déposer une demande pour eux-mêmes */
export const REQUESTER_ROLES: Role[] = [Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM];

export enum RequestStatus {
  PENDING_MANAGER = 'PENDING_MANAGER',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  REJECTED = 'REJECTED',
  APPROVED_BY_MANAGER = 'APPROVED_BY_MANAGER',
  PENDING_NETWORK = 'PENDING_NETWORK',
  IN_PROGRESS_NETWORK = 'IN_PROGRESS_NETWORK',
  ACTIVATED = 'ACTIVATED',
  REJECTED_TECHNICAL = 'REJECTED_TECHNICAL',
  CLOSED = 'CLOSED',
  EXPIRED = 'EXPIRED',
}

/** Types de formulaires numérisés (anciens formulaires papier) */
export enum RequestType {
  INTERNET_ACCESS = 'INTERNET_ACCESS',
  REMOTE_ACCESS = 'REMOTE_ACCESS',
  EXTERNAL_DRIVE = 'EXTERNAL_DRIVE',
  NETWORK_SHARE = 'NETWORK_SHARE',
  USB_3G_KEY = 'USB_3G_KEY',
  PASSWORD_COMMITMENT = 'PASSWORD_COMMITMENT',
}

export enum RequestKind {
  NEW = 'NEW',
  RENEWAL = 'RENEWAL',
}

export enum AccessType {
  FULL = 'FULL',
  STANDARD = 'STANDARD',
  RESTRICTED = 'RESTRICTED',
}

export enum DurationType {
  TEMPORARY = 'TEMPORARY',
  PERMANENT = 'PERMANENT',
}

export enum RecommendationLevel {
  LIKELY_LEGITIMATE = 'LIKELY_LEGITIMATE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  RISKY = 'RISKY',
}

export enum NotificationType {
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
  REQUEST_APPROVED = 'REQUEST_APPROVED',
  REQUEST_REJECTED = 'REQUEST_REJECTED',
  REQUEST_CHANGES_REQUESTED = 'REQUEST_CHANGES_REQUESTED',
  REQUEST_RESUBMITTED = 'REQUEST_RESUBMITTED',
  REQUEST_IN_PROGRESS = 'REQUEST_IN_PROGRESS',
  REQUEST_ACTIVATED = 'REQUEST_ACTIVATED',
  REQUEST_REJECTED_TECHNICAL = 'REQUEST_REJECTED_TECHNICAL',
  REQUEST_CLOSED = 'REQUEST_CLOSED',
  REQUEST_EXPIRED = 'REQUEST_EXPIRED',
  REQUEST_EXPIRING_SOON = 'REQUEST_EXPIRING_SOON',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
}

/** Nature d'un champ de formulaire (formulaires gérés par le super administrateur) */
export enum FormFieldKind {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  SELECT = 'select',
  COMMITMENT = 'commitment',
}

/** État d'un fil de discussion interne */
export enum ThreadStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

// ---------- Références peuplées ----------

export interface UserRef {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  matricule?: string;
  role?: Role;
}

export interface DepartmentRef {
  _id: string;
  name: string;
  code?: string;
}

export interface ServiceRef {
  _id: string;
  name: string;
}

// ---------- Modèles ----------

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  email: string;
  role: Role;
  department: DepartmentRef | null;
  service: ServiceRef | null;
  position: string;
  isActive: boolean;
  lastLoginAt: string | null;
  /** Date à laquelle l'employé a défini son mot de passe (null = compte non activé) */
  activatedAt: string | null;
  /** Date d'envoi du dernier lien d'accès temporaire */
  activationSentAt: string | null;
  /** Échéance du lien d'accès en cours */
  activationExpiresAt: string | null;
  /** true = l'application est bloquée jusqu'au changement de mot de passe */
  mustChangePassword: boolean;
  /** Responsable direct : c'est lui qui examine les demandes de cet utilisateur */
  manager?: UserRef | null;
  /** true = adresse générée à l'import, à remplacer (l'authentification unique ne marche pas) */
  emailIsTemporary?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** État lisible d'un compte, dérivé de isActive / activatedAt */
export type AccountState = 'ACTIVE' | 'PENDING_ACTIVATION' | 'DISABLED';

export function accountState(user: User): AccountState {
  if (!user.isActive) return 'DISABLED';
  return user.activatedAt ? 'ACTIVE' : 'PENDING_ACTIVATION';
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  manager: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceEntity {
  _id: string;
  name: string;
  description: string;
  department: DepartmentRef;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionSupport {
  score: number;
  level: RecommendationLevel;
  reasons: string[];
}

export interface AccessRequest {
  _id: string;
  reference: string;
  requestType: RequestType;
  requestKind: RequestKind;
  requester: UserRef;
  firstName: string;
  lastName: string;
  matricule: string;
  email: string;
  position: string;
  department: DepartmentRef;
  service: ServiceRef | null;
  accessType: AccessType | null;
  durationType: DurationType;
  durationDays: number | null;
  justification: string;
  formData: Record<string, unknown>;
  acknowledgementAccepted: boolean;
  acknowledgedAt: string | null;
  applicantSignature: string;
  applicantSignedAt: string | null;
  status: RequestStatus;
  managerDecisionBy: UserRef | null;
  managerDecisionAt: string | null;
  managerComment: string;
  rejectionReason: string;
  processedBy: UserRef | null;
  processedAt: string | null;
  networkComment: string;
  accessActivated: boolean | null;
  activationDate: string | null;
  expirationDate: string | null;
  closedAt: string | null;
  decisionSupport: DecisionSupport;
  createdAt: string;
  updatedAt: string;
}

export interface RequestHistoryEntry {
  _id: string;
  request: string;
  action: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  performedBy: UserRef | null;
  comment: string;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedRequest: { _id: string; reference: string; status: RequestStatus } | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  user: (UserRef & { email?: string; role?: Role }) | null;
  userEmail: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, unknown>;
  createdAt: string;
}

// ---------- Formulaires (définis en base, gérés par le super administrateur) ----------

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldDefinition {
  key: string;
  label: string;
  kind: FormFieldKind;
  required: boolean;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  placeholder: string;
  helpText: string;
  options: FormFieldOption[];
}

export interface FormDefinition {
  _id: string;
  requestType: RequestType;
  title: string;
  shortLabel: string;
  description: string;
  instructions: string;
  isActive: boolean;
  requiresAccessType: boolean;
  requiresDuration: boolean;
  requiresJustification: boolean;
  defaultJustification: string;
  fields: FormFieldDefinition[];
  updatedBy: UserRef | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormUsage {
  requestType: RequestType;
  totalRequests: number;
  byField: Record<string, number>;
}

// ---------- Messagerie interne (chef de département ↔ équipe réseau) ----------

export interface RequestThread {
  _id: string;
  request: string;
  reference: string;
  requestType: RequestType;
  department: DepartmentRef;
  requesterName: string;
  status: ThreadStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageBy: UserRef | null;
  messageCount: number;
  resolvedBy: UserRef | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestMessage {
  _id: string;
  thread: string;
  request: string;
  author: UserRef;
  authorRole: Role;
  body: string;
  readBy: string[];
  createdAt: string;
}

export interface ThreadView {
  thread: RequestThread | null;
  messages: RequestMessage[];
  request: {
    _id: string;
    reference: string;
    requestType: RequestType;
    status: RequestStatus;
    requesterName: string;
    departmentName: string;
  };
  /** Rôle du correspondant attendu en face */
  counterpart: 'MANAGER' | 'NETWORK_TEAM';
}

// ---------- Comptes ----------

/** Lien d'accès temporaire renvoyé à la personne habilitée (affiché une seule fois) */
export interface ActivationLink {
  url: string;
  expiresAt: string;
  isReset: boolean;
}

export interface CreatedUser {
  user: User;
  activation: ActivationLink;
}

/** Identité affichée sur la page publique d'activation */
export interface ActivationTarget {
  firstName: string;
  lastName: string;
  email: string;
  expiresAt: string | null;
  isReset: boolean;
}

export interface UsersSummary {
  byRole: Record<Role, number>;
  pendingActivation: User[];
}

// ---------- API ----------

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface StatsOverview {
  total: number;
  byStatus: Record<RequestStatus, number>;
  pendingManager: number;
  approvedByManager: number;
  rejected: number;
  processed: number;
  acceptanceRate: number;
  avgManagerDecisionHours: number;
  avgProcessingHours: number;
}

export interface DepartmentStats {
  departmentId: string;
  departmentName: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  activated: number;
}

export interface MonthlyStats {
  month: string;
  created: number;
  approved: number;
  rejected: number;
}

export interface TypeStats {
  requestType: RequestType;
  total: number;
  pending: number;
  rejected: number;
  executed: number;
}

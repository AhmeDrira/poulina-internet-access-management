// ---------- Enums (miroir du backend) ----------

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  NETWORK_TEAM = 'NETWORK_TEAM',
  ADMIN = 'ADMIN',
  SECURITY_OFFICER = 'SECURITY_OFFICER',
}

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
  createdAt: string;
  updatedAt: string;
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

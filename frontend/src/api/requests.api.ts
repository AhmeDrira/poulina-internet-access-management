import { api } from './client';
import {
  AccessRequest,
  AccessType,
  DurationType,
  Paginated,
  RequestHistoryEntry,
  RequestStatus,
  RequestType,
} from '../types';

export interface CreateRequestPayload {
  requestType: RequestType;
  accessType?: AccessType;
  durationType: DurationType;
  durationDays?: number;
  justification?: string;
  formData?: Record<string, unknown>;
  position?: string;
  serviceId?: string;
}

export type ResubmitRequestPayload = Omit<CreateRequestPayload, 'requestType'> & {
  resubmitComment?: string;
};

export interface RequestListParams {
  page?: number;
  limit?: number;
  status?: RequestStatus | '';
  requestType?: RequestType | '';
  department?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ProcessRequestPayload {
  accessActivated: boolean;
  activationDate?: string;
  expirationDate?: string;
  networkComment?: string;
}

export const requestsApi = {
  async create(payload: CreateRequestPayload): Promise<AccessRequest> {
    const { data } = await api.post<AccessRequest>('/access-requests', payload);
    return data;
  },

  /** Demandes de l'utilisateur connecté */
  async my(params: RequestListParams = {}): Promise<Paginated<AccessRequest>> {
    const { data } = await api.get<Paginated<AccessRequest>>('/access-requests/my', {
      params: cleanParams(params),
    });
    return data;
  },

  /** Demandes visibles selon le rôle (manager : département, réseau : file, admin : tout) */
  async list(params: RequestListParams = {}): Promise<Paginated<AccessRequest>> {
    const { data } = await api.get<Paginated<AccessRequest>>('/access-requests', {
      params: cleanParams(params),
    });
    return data;
  },

  async get(id: string): Promise<AccessRequest> {
    const { data } = await api.get<AccessRequest>(`/access-requests/${id}`);
    return data;
  },

  async history(id: string): Promise<RequestHistoryEntry[]> {
    const { data } = await api.get<RequestHistoryEntry[]>(`/access-requests/${id}/history`);
    return data;
  },

  async approve(id: string, comment?: string): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(`/access-requests/${id}/approve`, {
      comment: comment || undefined,
    });
    return data;
  },

  async reject(id: string, reason: string, comment?: string): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(`/access-requests/${id}/reject`, {
      reason,
      comment: comment || undefined,
    });
    return data;
  },

  /** Le chef demande une modification / des informations complémentaires */
  async requestChanges(id: string, comment: string): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(`/access-requests/${id}/request-changes`, {
      comment,
    });
    return data;
  },

  /** L'employé modifie et re-soumet sa demande (statut « modifications demandées ») */
  async resubmit(id: string, payload: ResubmitRequestPayload): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(`/access-requests/${id}/resubmit`, payload);
    return data;
  },

  /** Télécharge le formulaire rempli en PDF (via le client authentifié) */
  async downloadPdf(id: string, reference: string): Promise<void> {
    const response = await api.get(`/access-requests/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reference}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async startProcessing(id: string): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(
      `/access-requests/${id}/start-processing`,
      {},
    );
    return data;
  },

  async process(id: string, payload: ProcessRequestPayload): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(
      `/access-requests/${id}/process`,
      payload,
    );
    return data;
  },

  async close(id: string, comment?: string): Promise<AccessRequest> {
    const { data } = await api.patch<AccessRequest>(`/access-requests/${id}/close`, {
      comment: comment || undefined,
    });
    return data;
  },
};

function cleanParams(params: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );
}

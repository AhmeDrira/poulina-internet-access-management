import { api } from './client';
import { AccessType, DurationType, RequestType } from '../types';

export interface AiStatus {
  /** false si la clé API n'est pas configurée : les boutons IA sont masqués */
  enabled: boolean;
  /** Longueur de justification à partir de laquelle une synthèse est proposée */
  summaryThreshold: number;
}

export interface ImprovedJustification {
  /** Texte reformulé, vide si le brouillon est trop vague */
  improved: string;
  notes: string[];
  sufficient: boolean;
}

export interface JustificationSummary {
  summary: string;
  bullets: string[];
  generatedAt: string;
  cached: boolean;
}

export interface ImproveParams {
  requestType: RequestType;
  draft: string;
  accessType?: AccessType;
  durationType?: DurationType;
  durationDays?: number;
}

export const aiApi = {
  async status(): Promise<AiStatus> {
    const { data } = await api.get<AiStatus>('/ai/status');
    return data;
  },

  async improveJustification(params: ImproveParams): Promise<ImprovedJustification> {
    const { data } = await api.post<ImprovedJustification>('/ai/justification/improve', params);
    return data;
  },

  async summarize(requestId: string): Promise<JustificationSummary> {
    const { data } = await api.post<JustificationSummary>(
      `/ai/access-requests/${requestId}/summary`,
      {},
    );
    return data;
  },
};

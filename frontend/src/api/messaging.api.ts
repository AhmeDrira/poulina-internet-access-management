import { api } from './client';
import { Paginated, RequestThread, RequestType, ThreadStatus, ThreadView } from '../types';

export interface ThreadListParams {
  page?: number;
  limit?: number;
  status?: ThreadStatus | '';
  requestType?: RequestType | '';
  search?: string;
  unreadOnly?: boolean;
}

/**
 * Messagerie interne : accessible uniquement au chef de département et à
 * l'équipe réseau (le backend renvoie 403 pour les autres rôles).
 */
export const messagingApi = {
  async threads(params: ThreadListParams = {}): Promise<Paginated<RequestThread>> {
    const { data } = await api.get<Paginated<RequestThread>>('/messaging/threads', {
      params: cleanParams(params),
    });
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get<{ count: number }>('/messaging/unread-count');
    return data.count;
  },

  async unreadThreadIds(): Promise<string[]> {
    const { data } = await api.get<{ threadIds: string[] }>('/messaging/unread-threads');
    return data.threadIds;
  },

  async threadForRequest(requestId: string): Promise<ThreadView> {
    const { data } = await api.get<ThreadView>(`/messaging/requests/${requestId}`);
    return data;
  },

  async postMessage(requestId: string, body: string): Promise<ThreadView> {
    const { data } = await api.post<ThreadView>(`/messaging/requests/${requestId}/messages`, {
      body,
    });
    return data;
  },

  async setResolved(threadId: string, resolved: boolean): Promise<RequestThread> {
    const { data } = await api.patch<RequestThread>(
      `/messaging/threads/${threadId}/${resolved ? 'resolve' : 'reopen'}`,
      {},
    );
    return data;
  },
};

function cleanParams(params: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null && value !== false,
    ),
  );
}

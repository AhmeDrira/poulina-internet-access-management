import { api } from './client';
import { AppNotification, Paginated } from '../types';

export const notificationsApi = {
  async list(params: { page?: number; limit?: number; unreadOnly?: boolean } = {}): Promise<Paginated<AppNotification>> {
    const { data } = await api.get<Paginated<AppNotification>>('/notifications', { params });
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get<{ count: number }>('/notifications/unread-count');
    return data.count;
  },

  async markAsRead(id: string): Promise<AppNotification> {
    const { data } = await api.patch<AppNotification>(`/notifications/${id}/read`, {});
    return data;
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all', {});
  },
};

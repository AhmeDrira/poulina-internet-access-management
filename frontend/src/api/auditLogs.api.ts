import { api } from './client';
import { AuditLog, Paginated } from '../types';

export interface AuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const auditLogsApi = {
  async list(params: AuditLogParams = {}): Promise<Paginated<AuditLog>> {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
    );
    const { data } = await api.get<Paginated<AuditLog>>('/audit-logs', { params: cleaned });
    return data;
  },
};

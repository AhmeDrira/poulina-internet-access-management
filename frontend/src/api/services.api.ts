import { api } from './client';
import { ServiceEntity } from '../types';

export interface ServicePayload {
  name: string;
  description?: string;
  department: string;
}

export const servicesApi = {
  async list(departmentId?: string): Promise<ServiceEntity[]> {
    const { data } = await api.get<ServiceEntity[]>('/services', {
      params: departmentId ? { department: departmentId } : {},
    });
    return data;
  },

  async create(payload: ServicePayload): Promise<ServiceEntity> {
    const { data } = await api.post<ServiceEntity>('/services', payload);
    return data;
  },

  async update(id: string, payload: Partial<ServicePayload>): Promise<ServiceEntity> {
    const { data } = await api.patch<ServiceEntity>(`/services/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  },
};

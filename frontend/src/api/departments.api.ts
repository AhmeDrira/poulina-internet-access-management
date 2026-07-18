import { api } from './client';
import { Department } from '../types';

export interface DepartmentPayload {
  name: string;
  code: string;
  description?: string;
  manager?: string | null;
}

export const departmentsApi = {
  async list(): Promise<Department[]> {
    const { data } = await api.get<Department[]>('/departments');
    return data;
  },

  async get(id: string): Promise<Department> {
    const { data } = await api.get<Department>(`/departments/${id}`);
    return data;
  },

  async create(payload: DepartmentPayload): Promise<Department> {
    const { data } = await api.post<Department>('/departments', payload);
    return data;
  },

  async update(id: string, payload: Partial<DepartmentPayload>): Promise<Department> {
    const { data } = await api.patch<Department>(`/departments/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },
};

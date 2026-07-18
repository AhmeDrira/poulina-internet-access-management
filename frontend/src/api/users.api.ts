import { api } from './client';
import { Paginated, Role, User } from '../types';

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role | '';
  department?: string;
  isActive?: boolean | '';
}

export interface UserPayload {
  firstName: string;
  lastName: string;
  matricule: string;
  email: string;
  password?: string;
  role: Role;
  department?: string | null;
  service?: string | null;
  position?: string;
}

export const usersApi = {
  async list(params: UserListParams = {}): Promise<Paginated<User>> {
    const { data } = await api.get<Paginated<User>>('/users', {
      params: cleanParams(params),
    });
    return data;
  },

  async get(id: string): Promise<User> {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  async create(payload: UserPayload): Promise<User> {
    const { data } = await api.post<User>('/users', payload);
    return data;
  },

  async update(id: string, payload: Partial<UserPayload>): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}`, payload);
    return data;
  },

  async activate(id: string): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}/activate`, {});
    return data;
  },

  async deactivate(id: string): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}/deactivate`, {});
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};

function cleanParams(params: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );
}

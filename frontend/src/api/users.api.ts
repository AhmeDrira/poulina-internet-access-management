import { api } from './client';
import { ActivationLink, CreatedUser, Paginated, Role, User, UsersSummary } from '../types';

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role | '';
  department?: string;
  isActive?: boolean | '';
  pendingActivation?: boolean | '';
}

/**
 * Aucun mot de passe n'est transmis : les comptes sont créés par une personne
 * habilitée puis activés par l'employé via un lien temporaire.
 */
export interface UserPayload {
  firstName: string;
  lastName: string;
  matricule: string;
  email: string;
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

  /** Synthèse des comptes (réservée au super administrateur) */
  async summary(): Promise<UsersSummary> {
    const { data } = await api.get<UsersSummary>('/users/summary');
    return data;
  },

  /** Crée le compte et renvoie le lien d'activation à transmettre à l'employé */
  async create(payload: UserPayload): Promise<CreatedUser> {
    const { data } = await api.post<CreatedUser>('/users', payload);
    return data;
  },

  async update(id: string, payload: Partial<UserPayload>): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}`, payload);
    return data;
  },

  /**
   * Génère un lien d'accès temporaire : nouvelle invitation si le compte n'a
   * jamais été activé, réinitialisation du mot de passe sinon.
   */
  async issueActivationLink(id: string): Promise<ActivationLink> {
    const { data } = await api.post<ActivationLink>(`/users/${id}/activation-link`, {});
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

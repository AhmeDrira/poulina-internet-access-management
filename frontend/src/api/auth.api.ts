import { api } from './client';
import { ActivationTarget, LoginResponse, User } from '../types';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  /** Vérifie un lien d'activation temporaire (route publique) */
  async describeActivation(token: string): Promise<ActivationTarget> {
    const { data } = await api.get<ActivationTarget>(`/auth/activation/${token}`);
    return data;
  },

  /** Définit le mot de passe depuis le lien d'activation (usage unique) */
  async activate(token: string, password: string): Promise<{ message: string; email: string }> {
    const { data } = await api.post<{ message: string; email: string }>(
      `/auth/activation/${token}`,
      { password },
    );
    return data;
  },
};

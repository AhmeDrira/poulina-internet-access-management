import { api } from './client';
import { LoginResponse } from '../types';

export interface SsoConfig {
  /** false si l'authentification unique n'est pas configurée sur le serveur */
  enabled: boolean;
  label: string;
}

export const ssoApi = {
  async config(): Promise<SsoConfig> {
    const { data } = await api.get<SsoConfig>('/auth/sso/config');
    return data;
  },

  /**
   * Départ vers le fournisseur d'identité.
   * Navigation complète (et non requête AJAX) : c'est une redirection HTTP.
   */
  startLogin(returnTo = '/'): void {
    const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
    window.location.href = `${base}/auth/sso/login?returnTo=${encodeURIComponent(returnTo)}`;
  },

  /** Échange le code à usage unique reçu au retour contre un jeton de session */
  async exchange(code: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/sso/exchange', { code });
    return data;
  },
};

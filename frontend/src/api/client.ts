import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'pgh_access_token';
export const USER_KEY = 'pgh_user';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginCall) {
      // Session expirée ou token invalide : retour à la page de connexion
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Extrait un message d'erreur lisible depuis une erreur Axios/NestJS */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(' — ') : data.message;
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Impossible de contacter le serveur. Vérifiez que le backend est démarré.';
    }
    return error.message;
  }
  return 'Une erreur inattendue est survenue.';
}

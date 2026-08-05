/** Politique de mot de passe, alignée sur la validation du serveur */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES =
  '8 caractères minimum, avec au moins une lettre et un chiffre.';

/** Renvoie le message d'erreur à afficher, ou null si le mot de passe est conforme */
export function checkPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (password.length > 72) {
    return 'Le mot de passe ne peut pas dépasser 72 caractères.';
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre.';
  }
  if (!/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre.';
  }
  return null;
}

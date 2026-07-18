/**
 * Échappe les caractères spéciaux d'une saisie utilisateur avant de la
 * placer dans un filtre MongoDB $regex (évite injection regex / ReDoS).
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_PENDING_KEY = 'allowPasswordPending';

/**
 * Autorise la route même lorsque l'utilisateur doit d'abord changer
 * son mot de passe (profil, changement de mot de passe, déconnexion).
 */
export const AllowPasswordPending = () => SetMetadata(ALLOW_PASSWORD_PENDING_KEY, true);

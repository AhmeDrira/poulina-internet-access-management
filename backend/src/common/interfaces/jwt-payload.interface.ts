import { Role } from '../enums';

/** Contenu signé du token JWT */
export interface JwtPayload {
  /** Identifiant MongoDB de l'utilisateur */
  sub: string;
  email: string;
  role: Role;
}

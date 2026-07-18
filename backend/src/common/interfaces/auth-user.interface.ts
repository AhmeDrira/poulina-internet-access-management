import { Role } from '../enums';

/** Utilisateur attaché à la requête après validation du JWT (req.user) */
export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  matricule: string;
  departmentId: string | null;
  serviceId: string | null;
}

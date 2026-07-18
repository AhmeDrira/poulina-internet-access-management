import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export const ROLES_KEY = 'roles';

/** Restreint une route aux rôles indiqués (RBAC) */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

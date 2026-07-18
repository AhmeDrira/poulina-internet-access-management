import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Guard RBAC global : vérifie que le rôle de l'utilisateur figure
 * dans la liste déclarée via @Roles(). Sans métadonnée @Roles,
 * la route est accessible à tout utilisateur authentifié.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      // Route @Public : pas de contrôle de rôle
      return true;
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
      );
    }
    return true;
  }
}

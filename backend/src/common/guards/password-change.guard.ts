import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_PENDING_KEY } from '../decorators/allow-password-pending.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Guard global : lorsqu'un changement de mot de passe est imposé
 * (compte créé par un administrateur, réinitialisation demandée),
 * l'utilisateur ne peut rien faire d'autre que consulter son profil
 * et définir son nouveau mot de passe.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) {
      return true;
    }
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user?.mustChangePassword) {
      throw new ForbiddenException(
        'Vous devez d’abord définir un nouveau mot de passe avant d’utiliser l’application.',
      );
    }
    return true;
  }
}

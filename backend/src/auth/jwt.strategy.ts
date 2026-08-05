import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'secret-de-developpement',
    });
  }

  /** Appelé à chaque requête authentifiée : revalide l'utilisateur en base */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('Session invalide ou compte introuvable.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte a été désactivé.');
    }
    const department: any = user.department;
    const service: any = user.service;
    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      matricule: user.matricule,
      departmentId: department?._id ? department._id.toString() : null,
      serviceId: service?._id ? service._id.toString() : null,
      mustChangePassword: user.mustChangePassword === true,
    };
  }
}

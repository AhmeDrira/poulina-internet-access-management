import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmailWithPassword(email);

    const fail = async (reason: string) => {
      await this.auditLogs.record({
        userId: user ? user._id.toString() : null,
        userEmail: email,
        action: AuditAction.LOGIN_FAILED,
        ipAddress,
        userAgent,
        details: { raison: reason },
      });
      // Message identique quel que soit le cas : ne pas révéler si l'email existe
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    };

    if (!user) {
      return fail('Email inconnu');
    }
    if (!user.isActive) {
      return fail('Compte désactivé');
    }
    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      return fail('Mot de passe incorrect');
    }

    await this.usersService.updateLastLogin(user._id.toString());
    await this.auditLogs.record({
      userId: user._id.toString(),
      userEmail: email,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress,
      userAgent,
    });

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: await this.usersService.findById(user._id.toString()),
    };
  }

  async getProfile(authUser: AuthUser) {
    return this.usersService.findById(authUser.userId);
  }

  async changePassword(
    authUser: AuthUser,
    dto: ChangePasswordDto,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.usersService.findByEmailWithPassword(authUser.email);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect.');
    }
    await this.usersService.updatePassword(user._id.toString(), dto.newPassword);
    await this.auditLogs.record({
      userId: user._id.toString(),
      userEmail: user.email,
      action: AuditAction.PASSWORD_CHANGED,
      ipAddress,
      userAgent,
    });
    return { message: 'Mot de passe modifié avec succès.' };
  }
}

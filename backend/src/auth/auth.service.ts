import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { SsoIdentity } from './sso.service';

/** Informations minimales affichées sur la page d'activation (lien temporaire) */
export interface ActivationTarget {
  firstName: string;
  lastName: string;
  email: string;
  expiresAt: Date | null;
  /** true = redéfinition du mot de passe d'un compte déjà activé */
  isReset: boolean;
}

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

    const fail = async (reason: string, message?: string) => {
      await this.auditLogs.record({
        userId: user ? user._id.toString() : null,
        userEmail: email,
        action: AuditAction.LOGIN_FAILED,
        ipAddress,
        userAgent,
        details: { raison: reason },
      });
      // Message identique quel que soit le cas : ne pas révéler si l'email existe
      throw new UnauthorizedException(message ?? 'Email ou mot de passe incorrect.');
    };

    if (!user) {
      return fail('Email inconnu');
    }
    if (!user.isActive) {
      return fail('Compte désactivé');
    }
    if (!user.password) {
      // Compte créé par un administrateur, jamais activé : message explicite
      // pour orienter l'employé vers son lien d'activation.
      return fail(
        'Compte non activé',
        "Ce compte n'est pas encore activé. Utilisez le lien d'activation reçu, ou demandez-en un nouveau à votre administrateur.",
      );
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

  // ------------------------------------------------------------------
  // Authentification unique (SSO / OpenID Connect)
  // ------------------------------------------------------------------

  /**
   * Rattache l'identité fournie par le fournisseur d'identité à un compte de
   * l'application. Aucun compte n'est créé automatiquement : conformément au
   * principe « le compte est créé par une personne habilitée », une adresse
   * inconnue est refusée.
   */
  async resolveSsoUser(
    identity: SsoIdentity,
    ipAddress: string,
    userAgent: string,
  ): Promise<UserDocument> {
    const user = await this.usersService.findByEmailWithPassword(identity.email);

    const fail = async (reason: string, message: string) => {
      await this.auditLogs.record({
        userId: user ? user._id.toString() : null,
        userEmail: identity.email,
        action: AuditAction.LOGIN_FAILED,
        ipAddress,
        userAgent,
        details: { raison: reason, methode: 'SSO' },
      });
      throw new UnauthorizedException(message);
    };

    if (!user) {
      await fail(
        'Compte SSO inconnu',
        `Aucun compte n'est associé à ${identity.email} dans l'application. Contactez votre administrateur.`,
      );
    }
    if (!user!.isActive) {
      await fail('Compte désactivé', 'Votre compte est désactivé. Contactez votre administrateur.');
    }

    // L'identité est prouvée par le fournisseur : le compte devient utilisable
    await this.usersService.markSsoAuthenticated(user!._id.toString(), identity.subject);
    return user!;
  }

  /**
   * Ouvre la session applicative après une authentification SSO validée
   * (le code d'échange à usage unique a déjà été consommé).
   */
  async issueSsoSession(userId: string, ipAddress: string, userAgent: string) {
    const user = await this.usersService.findById(userId);
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte a été désactivé.');
    }

    await this.usersService.updateLastLogin(userId);
    await this.auditLogs.record({
      userId,
      userEmail: user.email,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress,
      userAgent,
      details: { methode: 'SSO' },
    });

    const payload: JwtPayload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
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
    if (!user.password) {
      throw new UnauthorizedException(
        "Ce compte n'a pas encore de mot de passe : utilisez votre lien d'activation.",
      );
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

  // ------------------------------------------------------------------
  // Activation d'un compte par lien temporaire (routes publiques)
  // ------------------------------------------------------------------

  /** Vérifie le lien et renvoie l'identité du compte concerné */
  async describeActivation(
    token: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ActivationTarget> {
    try {
      const user = await this.usersService.findByActivationToken(token);
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        expiresAt: user.activationExpiresAt,
        isReset: user.activatedAt !== null,
      };
    } catch (error) {
      await this.auditLogs.record({
        userId: null,
        userEmail: 'lien-activation',
        action: AuditAction.ACTIVATION_FAILED,
        ipAddress,
        userAgent,
        details: { etape: 'ouverture du lien', raison: (error as Error).message },
      });
      throw error;
    }
  }

  /**
   * Consomme le lien : le mot de passe choisi est enregistré, le lien devient
   * inutilisable et le compte est pleinement opérationnel.
   */
  async activateAccount(
    token: string,
    dto: SetPasswordDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ message: string; email: string }> {
    let user;
    try {
      user = await this.usersService.consumeActivationToken(token, dto.password);
    } catch (error) {
      await this.auditLogs.record({
        userId: null,
        userEmail: 'lien-activation',
        action: AuditAction.ACTIVATION_FAILED,
        ipAddress,
        userAgent,
        details: { etape: 'définition du mot de passe', raison: (error as Error).message },
      });
      throw error;
    }

    await this.auditLogs.record({
      userId: user._id.toString(),
      userEmail: user.email,
      action: AuditAction.ACCOUNT_ACTIVATED,
      ipAddress,
      userAgent,
    });

    return {
      message: 'Votre mot de passe est enregistré. Vous pouvez maintenant vous connecter.',
      email: user.email,
    };
  }
}

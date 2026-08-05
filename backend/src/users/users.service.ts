import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  AccessRequest,
  AccessRequestDocument,
} from '../access-requests/schemas/access-request.schema';
import {
  RequestHistory,
  RequestHistoryDocument,
} from '../access-requests/schemas/request-history.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, PRIVILEGED_ROLES, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../common/interfaces/paginated-result.interface';
import { escapeRegex } from '../common/utils/regex.util';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { RequestMessage, RequestMessageDocument } from '../messaging/schemas/request-message.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 10;
const POPULATE_DEPARTMENT = { path: 'department', select: 'name code' };
const POPULATE_SERVICE = { path: 'service', select: 'name' };
const DEFAULT_ACTIVATION_TTL_HOURS = 48;

interface AuditContext {
  actor?: AuthUser;
  ipAddress?: string;
  userAgent?: string;
}

/** Lien d'activation temporaire remis à la personne habilitée qui crée le compte */
export interface ActivationLink {
  /** Lien complet à transmettre à l'employé (affiché une seule fois) */
  url: string;
  expiresAt: Date;
  /** Le compte a-t-il déjà été activé une première fois ? */
  isReset: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(AccessRequest.name)
    private readonly requestModel: Model<AccessRequestDocument>,
    @InjectModel(RequestHistory.name)
    private readonly historyModel: Model<RequestHistoryDocument>,
    @InjectModel(RequestMessage.name)
    private readonly messageModel: Model<RequestMessageDocument>,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async findAll(query: UserQueryDto): Promise<PaginatedResult<UserDocument>> {
    const filter: Record<string, any> = {};
    if (query.role) {
      filter.role = query.role;
    }
    if (query.department) {
      filter.department = new Types.ObjectId(query.department);
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }
    if (query.pendingActivation !== undefined) {
      filter.activatedAt = query.pendingActivation ? null : { $ne: null };
    }
    if (query.search) {
      const regex = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { matricule: regex },
      ];
    }
    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ lastName: 1, firstName: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .populate(POPULATE_DEPARTMENT)
        .populate(POPULATE_SERVICE)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide.');
    }
    const user = await this.userModel
      .findById(id)
      .populate(POPULATE_DEPARTMENT)
      .populate(POPULATE_SERVICE)
      .exec();
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return user;
  }

  /** Utilisé par l'authentification : renvoie le hash du mot de passe */
  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .exec();
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { lastLoginAt: new Date() });
  }

  /** Enregistre un nouveau mot de passe et lève l'obligation de changement */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userModel.updateOne(
      { _id: id },
      {
        password: hash,
        mustChangePassword: false,
        activationTokenHash: null,
        activationExpiresAt: null,
      },
    );
  }

  /** Répartition des comptes par rôle (console de supervision) */
  async countByRole(): Promise<Record<string, number>> {
    const rows = await this.userModel.aggregate<{ _id: Role; count: number }>([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const role of Object.values(Role)) {
      counts[role] = 0;
    }
    for (const row of rows) {
      counts[row._id] = row.count;
    }
    return counts;
  }

  /** Comptes créés mais jamais activés (lien non encore utilisé) */
  async findPendingActivation(limit = 10): Promise<UserDocument[]> {
    return this.userModel
      .find({ activatedAt: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate(POPULATE_DEPARTMENT)
      .exec();
  }

  // ------------------------------------------------------------------
  // Création : compte créé par une personne habilitée + lien d'activation
  // ------------------------------------------------------------------

  async create(
    dto: CreateUserDto,
    context: AuditContext = {},
  ): Promise<{ user: UserDocument; activation: ActivationLink }> {
    this.assertCanAssignRole(context.actor, dto.role);
    await this.assertUnique(dto.email, dto.matricule);
    await this.assertDepartmentAndService(dto.department, dto.service);

    const { token, hash, expiresAt } = this.buildActivationToken();

    const created = await this.userModel.create({
      ...dto,
      email: dto.email.toLowerCase().trim(),
      // Aucun mot de passe : le compte n'est utilisable qu'après activation
      password: null,
      department: dto.department ? new Types.ObjectId(dto.department) : null,
      service: dto.service ? new Types.ObjectId(dto.service) : null,
      activationTokenHash: hash,
      activationExpiresAt: expiresAt,
      activationSentAt: new Date(),
      activatedAt: null,
      mustChangePassword: false,
      invitedBy: context.actor ? new Types.ObjectId(context.actor.userId) : null,
    });

    const activation: ActivationLink = {
      url: this.activationUrl(token),
      expiresAt,
      isReset: false,
    };

    await this.notifications.dispatchAccountInvitation({
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      activationUrl: activation.url,
      expiresAt,
      isReset: false,
    });

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.USER_INVITED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        cible: created.email,
        role: created.role,
        matricule: created.matricule,
        expiration: expiresAt.toISOString(),
      },
    });

    return { user: await this.findById(created._id.toString()), activation };
  }

  /**
   * (Re)génère un lien d'accès temporaire :
   *  - compte jamais activé  → nouveau lien d'activation (l'ancien est invalidé) ;
   *  - compte déjà activé    → réinitialisation : le lien permet de redéfinir le
   *    mot de passe et le changement devient obligatoire.
   */
  async issueActivationLink(id: string, context: AuditContext = {}): Promise<ActivationLink> {
    const user = await this.findById(id);
    this.assertCanManage(context.actor, user);
    if (!user.isActive) {
      throw new BadRequestException(
        'Ce compte est désactivé : réactivez-le avant de générer un lien d’accès.',
      );
    }

    const isReset = user.activatedAt !== null;
    const { token, hash, expiresAt } = this.buildActivationToken();

    user.activationTokenHash = hash;
    user.activationExpiresAt = expiresAt;
    user.activationSentAt = new Date();
    if (isReset) {
      // Le mot de passe actuel reste valable pour se connecter,
      // mais l'application impose son remplacement immédiat.
      user.mustChangePassword = true;
    }
    await user.save();

    const link: ActivationLink = { url: this.activationUrl(token), expiresAt, isReset };

    await this.notifications.dispatchAccountInvitation({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      activationUrl: link.url,
      expiresAt,
      isReset,
    });

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: isReset ? AuditAction.PASSWORD_RESET_ENFORCED : AuditAction.USER_INVITATION_RESENT,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { cible: user.email, expiration: expiresAt.toISOString() },
    });

    return link;
  }

  // ------------------------------------------------------------------
  // Activation par lien temporaire (routes publiques)
  // ------------------------------------------------------------------

  /** Retrouve le compte associé à un lien d'activation valide (usage unique, non expiré) */
  async findByActivationToken(token: string): Promise<UserDocument> {
    const hash = this.hashToken(token);
    const user = await this.userModel
      .findOne({ activationTokenHash: hash })
      .select('+activationTokenHash')
      .exec();

    if (!user) {
      throw new NotFoundException(
        'Ce lien est invalide ou a déjà été utilisé. Demandez un nouveau lien à votre administrateur.',
      );
    }
    if (!user.isActive) {
      throw new ForbiddenException('Ce compte est désactivé. Contactez votre administrateur.');
    }
    if (!user.activationExpiresAt || user.activationExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Ce lien a expiré. Demandez un nouveau lien à votre administrateur.',
      );
    }
    return user;
  }

  /**
   * Consomme le lien : enregistre le mot de passe choisi, invalide le lien
   * (usage unique) et rend le compte pleinement utilisable.
   */
  async consumeActivationToken(token: string, password: string): Promise<UserDocument> {
    const user = await this.findByActivationToken(token);
    const firstActivation = user.activatedAt === null;

    user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.activationTokenHash = null;
    user.activationExpiresAt = null;
    user.mustChangePassword = false;
    if (firstActivation) {
      user.activatedAt = new Date();
    }
    await user.save();

    return user;
  }

  // ------------------------------------------------------------------
  // Modification / état / suppression
  // ------------------------------------------------------------------

  async update(id: string, dto: UpdateUserDto, context: AuditContext = {}): Promise<UserDocument> {
    const user = await this.findById(id);
    this.assertCanManage(context.actor, user);
    if (dto.role && dto.role !== user.role) {
      this.assertCanAssignRole(context.actor, dto.role);
      if (context.actor && context.actor.userId === id) {
        throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle.');
      }
      await this.assertNotLastSuperAdmin(user, 'changer le rôle');
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const exists = await this.userModel.findOne({ email: dto.email.toLowerCase().trim() });
      if (exists) {
        throw new ConflictException('Cette adresse email est déjà utilisée.');
      }
    }
    if (dto.matricule && dto.matricule.toUpperCase() !== user.matricule) {
      const exists = await this.userModel.findOne({ matricule: dto.matricule.toUpperCase() });
      if (exists) {
        throw new ConflictException('Ce matricule est déjà utilisé.');
      }
    }
    await this.assertDepartmentAndService(dto.department, dto.service);

    const oldRole = user.role;
    const updates: Record<string, any> = { ...dto };
    if (dto.email) {
      updates.email = dto.email.toLowerCase().trim();
    }
    if (dto.department !== undefined) {
      updates.department = dto.department ? new Types.ObjectId(dto.department) : null;
    }
    if (dto.service !== undefined) {
      updates.service = dto.service ? new Types.ObjectId(dto.service) : null;
    }

    await this.userModel.updateOne({ _id: id }, updates);

    const roleChanged = dto.role && dto.role !== oldRole;
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: roleChanged ? AuditAction.ROLE_CHANGED : AuditAction.USER_UPDATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: roleChanged
        ? { cible: user.email, ancienRole: oldRole, nouveauRole: dto.role }
        : { cible: user.email, champs: Object.keys(dto) },
    });
    return this.findById(id);
  }

  async setActive(id: string, active: boolean, context: AuditContext = {}): Promise<UserDocument> {
    if (context.actor && context.actor.userId === id) {
      throw new BadRequestException('Vous ne pouvez pas modifier l’état de votre propre compte.');
    }
    const user = await this.findById(id);
    this.assertCanManage(context.actor, user);
    if (!active) {
      await this.assertNotLastSuperAdmin(user, 'désactiver le compte');
    }
    user.isActive = active;
    await user.save();
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { cible: user.email },
    });
    return user;
  }

  async remove(id: string, context: AuditContext = {}): Promise<{ message: string }> {
    if (context.actor && context.actor.userId === id) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte.');
    }
    const user = await this.findById(id);
    this.assertCanManage(context.actor, user);
    await this.assertNotLastSuperAdmin(user, 'supprimer le compte');
    await this.assertNotReferenced(user);

    await this.userModel.deleteOne({ _id: id });
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.USER_DELETED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { cible: user.email, matricule: user.matricule },
    });
    return { message: 'Utilisateur supprimé.' };
  }

  /** Renvoie les utilisateurs actifs d'un rôle donné (notifications de groupe) */
  async findActiveByRole(role: Role): Promise<UserDocument[]> {
    return this.userModel.find({ role, isActive: true }).exec();
  }

  // ------------------------------------------------------------------
  // Règles d'habilitation
  // ------------------------------------------------------------------

  /**
   * Seul un super administrateur peut créer ou promouvoir un compte
   * administrateur : un administrateur simple ne peut pas s'octroyer
   * (ni octroyer) davantage de privilèges.
   */
  private assertCanAssignRole(actor: AuthUser | undefined, role: Role): void {
    if (!actor) return;
    if (PRIVILEGED_ROLES.includes(role) && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Seul le super administrateur peut créer ou modifier un compte administrateur.',
      );
    }
  }

  /** La gestion d'un compte privilégié est réservée au super administrateur */
  private assertCanManage(actor: AuthUser | undefined, target: UserDocument): void {
    if (!actor) return;
    if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Seul le super administrateur peut gérer les comptes administrateurs.',
      );
    }
  }

  /** L'application doit toujours conserver au moins un super administrateur actif */
  private async assertNotLastSuperAdmin(target: UserDocument, action: string): Promise<void> {
    if (target.role !== Role.SUPER_ADMIN) return;
    const remaining = await this.userModel.countDocuments({
      role: Role.SUPER_ADMIN,
      isActive: true,
      _id: { $ne: target._id },
    });
    if (remaining === 0) {
      throw new BadRequestException(
        `Impossible de ${action} : l'application doit conserver au moins un super administrateur actif.`,
      );
    }
  }

  /**
   * Empêche la suppression d'un compte encore référencé (demandes, décisions,
   * historique, messagerie, responsabilité de département) : la désactivation
   * doit être préférée, sinon la traçabilité serait rompue.
   */
  private async assertNotReferenced(user: UserDocument): Promise<void> {
    const id = user._id;
    const [requests, decisions, processings, history, departments, messages] = await Promise.all([
      this.requestModel.countDocuments({ requester: id }),
      this.requestModel.countDocuments({ managerDecisionBy: id }),
      this.requestModel.countDocuments({ processedBy: id }),
      this.historyModel.countDocuments({ performedBy: id }),
      this.departmentModel.countDocuments({ manager: id }),
      this.messageModel.countDocuments({ author: id }),
    ]);

    const reasons: string[] = [];
    if (requests > 0) reasons.push(`${requests} demande(s) déposée(s)`);
    if (decisions > 0) reasons.push(`${decisions} décision(s) de validation`);
    if (processings > 0) reasons.push(`${processings} traitement(s) technique(s)`);
    if (history > 0) reasons.push(`${history} action(s) dans l'historique`);
    if (departments > 0) reasons.push(`${departments} département(s) sous sa responsabilité`);
    if (messages > 0) reasons.push(`${messages} message(s) interne(s)`);

    if (reasons.length > 0) {
      throw new ConflictException(
        `Suppression impossible : ce compte est référencé (${reasons.join(', ')}). ` +
          'Désactivez-le pour bloquer la connexion tout en préservant la traçabilité.',
      );
    }
  }

  // ------------------------------------------------------------------
  // Privé
  // ------------------------------------------------------------------

  /** Génère un lien à usage unique : seule son empreinte SHA-256 est stockée */
  private buildActivationToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('hex');
    const hours = Number(
      this.config.get<string>('ACTIVATION_TOKEN_TTL_HOURS') ?? DEFAULT_ACTIVATION_TTL_HOURS,
    );
    const ttl = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ACTIVATION_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttl * 3_600_000);
    return { token, hash: this.hashToken(token), expiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private activationUrl(token: string): string {
    const base = (this.config.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    return `${base}/activation/${token}`;
  }

  private async assertUnique(email: string, matricule: string): Promise<void> {
    const [emailExists, matriculeExists] = await Promise.all([
      this.userModel.findOne({ email: email.toLowerCase().trim() }),
      this.userModel.findOne({ matricule: matricule.toUpperCase() }),
    ]);
    if (emailExists) {
      throw new ConflictException('Cette adresse email est déjà utilisée.');
    }
    if (matriculeExists) {
      throw new ConflictException('Ce matricule est déjà utilisé.');
    }
  }

  private async assertDepartmentAndService(
    departmentId?: string,
    serviceId?: string,
  ): Promise<void> {
    if (departmentId) {
      const department = await this.departmentModel.findById(departmentId);
      if (!department) {
        throw new BadRequestException('Le département sélectionné est introuvable.');
      }
    }
    if (serviceId) {
      const service = await this.serviceModel.findById(serviceId);
      if (!service) {
        throw new BadRequestException('Le service sélectionné est introuvable.');
      }
      if (departmentId && service.department.toString() !== departmentId) {
        throw new BadRequestException(
          'Le service sélectionné n’appartient pas au département choisi.',
        );
      }
    }
  }
}

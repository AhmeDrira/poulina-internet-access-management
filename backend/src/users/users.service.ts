import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../common/interfaces/paginated-result.interface';
import { escapeRegex } from '../common/utils/regex.util';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 10;
const POPULATE_DEPARTMENT = { path: 'department', select: 'name code' };
const POPULATE_SERVICE = { path: 'service', select: 'name' };

interface AuditContext {
  actor?: AuthUser;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    private readonly auditLogs: AuditLogsService,
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

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userModel.updateOne({ _id: id }, { password: hash });
  }

  async create(dto: CreateUserDto, context: AuditContext = {}): Promise<UserDocument> {
    await this.assertUnique(dto.email, dto.matricule);
    await this.assertDepartmentAndService(dto.department, dto.service);

    const created = await this.userModel.create({
      ...dto,
      email: dto.email.toLowerCase().trim(),
      password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      department: dto.department ? new Types.ObjectId(dto.department) : null,
      service: dto.service ? new Types.ObjectId(dto.service) : null,
    });

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.USER_CREATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { cible: created.email, role: created.role, matricule: created.matricule },
    });
    return this.findById(created._id.toString());
  }

  async update(id: string, dto: UpdateUserDto, context: AuditContext = {}): Promise<UserDocument> {
    const user = await this.findById(id);

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
    if (dto.password) {
      updates.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    } else {
      delete updates.password;
    }
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

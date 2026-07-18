import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department, DepartmentDocument } from './schemas/department.schema';

interface AuditContext {
  actor?: AuthUser;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(): Promise<DepartmentDocument[]> {
    return this.departmentModel
      .find()
      .sort({ name: 1 })
      .populate('manager', 'firstName lastName email')
      .exec();
  }

  async findById(id: string): Promise<DepartmentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide.');
    }
    const department = await this.departmentModel
      .findById(id)
      .populate('manager', 'firstName lastName email')
      .exec();
    if (!department) {
      throw new NotFoundException('Département introuvable.');
    }
    return department;
  }

  async create(dto: CreateDepartmentDto, context: AuditContext = {}): Promise<DepartmentDocument> {
    await this.assertUnique(dto.name, dto.code);
    await this.assertManager(dto.manager);

    const created = await this.departmentModel.create({
      ...dto,
      manager: dto.manager ? new Types.ObjectId(dto.manager) : null,
    });
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.DEPARTMENT_CREATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { nom: created.name, code: created.code },
    });
    return this.findById(created._id.toString());
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    context: AuditContext = {},
  ): Promise<DepartmentDocument> {
    const department = await this.findById(id);
    if (dto.name && dto.name !== department.name) {
      const exists = await this.departmentModel.findOne({ name: dto.name });
      if (exists) {
        throw new ConflictException('Un département porte déjà ce nom.');
      }
    }
    if (dto.code && dto.code.toUpperCase() !== department.code) {
      const exists = await this.departmentModel.findOne({ code: dto.code.toUpperCase() });
      if (exists) {
        throw new ConflictException('Un département porte déjà ce code.');
      }
    }
    await this.assertManager(dto.manager);

    const updates: Record<string, any> = { ...dto };
    if (dto.manager !== undefined) {
      updates.manager = dto.manager ? new Types.ObjectId(dto.manager) : null;
    }
    await this.departmentModel.updateOne({ _id: id }, updates);

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.DEPARTMENT_UPDATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { nom: department.name, champs: Object.keys(dto) },
    });
    return this.findById(id);
  }

  async remove(id: string, context: AuditContext = {}): Promise<{ message: string }> {
    const department = await this.findById(id);
    const [usersCount, servicesCount] = await Promise.all([
      this.userModel.countDocuments({ department: department._id }),
      this.serviceModel.countDocuments({ department: department._id }),
    ]);
    if (usersCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ${usersCount} utilisateur(s) sont rattachés à ce département.`,
      );
    }
    if (servicesCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ${servicesCount} service(s) sont rattachés à ce département.`,
      );
    }
    await this.departmentModel.deleteOne({ _id: id });
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.DEPARTMENT_DELETED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { nom: department.name, code: department.code },
    });
    return { message: 'Département supprimé.' };
  }

  private async assertUnique(name: string, code: string): Promise<void> {
    const [nameExists, codeExists] = await Promise.all([
      this.departmentModel.findOne({ name }),
      this.departmentModel.findOne({ code: code.toUpperCase() }),
    ]);
    if (nameExists) {
      throw new ConflictException('Un département porte déjà ce nom.');
    }
    if (codeExists) {
      throw new ConflictException('Un département porte déjà ce code.');
    }
  }

  private async assertManager(managerId?: string | null): Promise<void> {
    if (!managerId) return;
    const manager = await this.userModel.findById(managerId);
    if (!manager) {
      throw new BadRequestException('L’utilisateur choisi comme chef est introuvable.');
    }
    if (manager.role !== Role.MANAGER && manager.role !== Role.ADMIN) {
      throw new BadRequestException(
        'L’utilisateur choisi doit avoir le rôle Chef de département.',
      );
    }
  }
}

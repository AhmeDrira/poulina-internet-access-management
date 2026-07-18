import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service, ServiceDocument } from './schemas/service.schema';

interface AuditContext {
  actor?: AuthUser;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(departmentId?: string): Promise<ServiceDocument[]> {
    const filter: Record<string, any> = {};
    if (departmentId) {
      if (!Types.ObjectId.isValid(departmentId)) {
        throw new BadRequestException('Identifiant de département invalide.');
      }
      filter.department = new Types.ObjectId(departmentId);
    }
    return this.serviceModel
      .find(filter)
      .sort({ name: 1 })
      .populate('department', 'name code')
      .exec();
  }

  async findById(id: string): Promise<ServiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide.');
    }
    const service = await this.serviceModel
      .findById(id)
      .populate('department', 'name code')
      .exec();
    if (!service) {
      throw new NotFoundException('Service introuvable.');
    }
    return service;
  }

  async create(dto: CreateServiceDto, context: AuditContext = {}): Promise<ServiceDocument> {
    const department = await this.departmentModel.findById(dto.department);
    if (!department) {
      throw new BadRequestException('Le département de rattachement est introuvable.');
    }
    await this.assertNameUniqueInDepartment(dto.name, dto.department);

    const created = await this.serviceModel.create({
      ...dto,
      department: new Types.ObjectId(dto.department),
    });
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.SERVICE_CREATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { nom: created.name, departement: department.name },
    });
    return this.findById(created._id.toString());
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    context: AuditContext = {},
  ): Promise<ServiceDocument> {
    const service = await this.findById(id);
    const targetDepartment = dto.department ?? service.department._id.toString();

    if (dto.department) {
      const department = await this.departmentModel.findById(dto.department);
      if (!department) {
        throw new BadRequestException('Le département de rattachement est introuvable.');
      }
    }
    if (dto.name && dto.name !== service.name) {
      await this.assertNameUniqueInDepartment(dto.name, targetDepartment, id);
    }

    const updates: Record<string, any> = { ...dto };
    if (dto.department) {
      updates.department = new Types.ObjectId(dto.department);
    }
    await this.serviceModel.updateOne({ _id: id }, updates);

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.SERVICE_UPDATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { nom: service.name, champs: Object.keys(dto) },
    });
    return this.findById(id);
  }

  async remove(id: string, context: AuditContext = {}): Promise<{ message: string }> {
    const service = await this.findById(id);
    const usersCount = await this.userModel.countDocuments({ service: service._id });
    if (usersCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ${usersCount} utilisateur(s) sont affectés à ce service.`,
      );
    }
    await this.serviceModel.deleteOne({ _id: id });
    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.SERVICE_DELETED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { nom: service.name },
    });
    return { message: 'Service supprimé.' };
  }

  private async assertNameUniqueInDepartment(
    name: string,
    departmentId: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: Record<string, any> = {
      name,
      department: new Types.ObjectId(departmentId),
    };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const exists = await this.serviceModel.findOne(filter);
    if (exists) {
      throw new ConflictException('Un service porte déjà ce nom dans ce département.');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditAction } from '../common/enums';
import { buildPaginatedResult, PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { escapeRegex } from '../common/utils/regex.util';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditEntry {
  userId?: string | Types.ObjectId | null;
  userEmail?: string;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export interface AuditLogFilters {
  page: number;
  limit: number;
  action?: AuditAction;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Enregistre une action dans le journal d'audit.
   * Ne lève jamais d'exception : la traçabilité ne doit pas casser le métier.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditLogModel.create({
        user: entry.userId ? new Types.ObjectId(entry.userId) : null,
        userEmail: entry.userEmail ?? '',
        action: entry.action,
        ipAddress: entry.ipAddress ?? '',
        userAgent: entry.userAgent ?? '',
        details: entry.details ?? {},
      });
    } catch (error) {
      this.logger.error(`Échec d'écriture du journal d'audit : ${error}`);
    }
  }

  async findAll(filters: AuditLogFilters): Promise<PaginatedResult<AuditLogDocument>> {
    const query: Record<string, any> = {};
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.userId) {
      query.user = new Types.ObjectId(filters.userId);
    }
    if (filters.search) {
      query.userEmail = { $regex: escapeRegex(filters.search), $options: 'i' };
    }
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    const skip = (filters.page - 1) * filters.limit;
    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .populate('user', 'firstName lastName email role')
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);
    return buildPaginatedResult(data, total, filters.page, filters.limit);
  }
}

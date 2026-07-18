import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AccessRequest,
  AccessRequestDocument,
} from '../access-requests/schemas/access-request.schema';
import { RequestStatus, RequestType, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';

const APPROVED_SIDE_STATUSES = [
  RequestStatus.APPROVED_BY_MANAGER,
  RequestStatus.PENDING_NETWORK,
  RequestStatus.IN_PROGRESS_NETWORK,
];
const PROCESSED_STATUSES = [
  RequestStatus.ACTIVATED,
  RequestStatus.REJECTED_TECHNICAL,
  RequestStatus.CLOSED,
  RequestStatus.EXPIRED,
];

/** Statuts où le chef n'a pas encore tranché définitivement */
const UNDECIDED_STATUSES = [RequestStatus.PENDING_MANAGER, RequestStatus.CHANGES_REQUESTED];

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(AccessRequest.name)
    private readonly requestModel: Model<AccessRequestDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  /** Un chef de département ne voit que les statistiques de son département */
  private scopeFilter(user: AuthUser): Record<string, any> {
    if (user.role !== Role.MANAGER) {
      return {};
    }
    if (!user.departmentId) {
      throw new ForbiddenException("Votre compte n'est rattaché à aucun département.");
    }
    return { department: new Types.ObjectId(user.departmentId) };
  }

  async overview(user: AuthUser) {
    const scope = this.scopeFilter(user);

    const statusCounts = await this.requestModel.aggregate([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(RequestStatus)) {
      byStatus[status] = 0;
    }
    let total = 0;
    for (const row of statusCounts) {
      byStatus[row._id] = row.count;
      total += row.count;
    }

    const approvedByManager = APPROVED_SIDE_STATUSES.reduce(
      (sum, status) => sum + byStatus[status],
      0,
    );
    const processed = PROCESSED_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
    const rejected = byStatus[RequestStatus.REJECTED];

    // Taux d'acceptation parmi les demandes déjà décidées par un chef
    // (une demande "modifications demandées" n'est pas encore tranchée)
    const [decided, approvedDecided] = await Promise.all([
      this.requestModel.countDocuments({
        ...scope,
        managerDecisionAt: { $ne: null },
        status: { $nin: UNDECIDED_STATUSES },
      }),
      this.requestModel.countDocuments({
        ...scope,
        managerDecisionAt: { $ne: null },
        status: { $nin: [...UNDECIDED_STATUSES, RequestStatus.REJECTED] },
      }),
    ]);
    const acceptanceRate = decided > 0 ? Math.round((approvedDecided / decided) * 100) : 0;

    const [managerDelay] = await this.requestModel.aggregate([
      { $match: { ...scope, managerDecisionAt: { $ne: null } } },
      {
        $project: {
          hours: {
            $divide: [{ $subtract: ['$managerDecisionAt', '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: '$hours' } } },
    ]);
    const [processingDelay] = await this.requestModel.aggregate([
      { $match: { ...scope, processedAt: { $ne: null } } },
      {
        $project: {
          hours: { $divide: [{ $subtract: ['$processedAt', '$createdAt'] }, 1000 * 60 * 60] },
        },
      },
      { $group: { _id: null, avg: { $avg: '$hours' } } },
    ]);

    return {
      total,
      byStatus,
      pendingManager: byStatus[RequestStatus.PENDING_MANAGER],
      approvedByManager,
      rejected,
      processed,
      acceptanceRate,
      avgManagerDecisionHours: managerDelay ? Math.round(managerDelay.avg * 10) / 10 : 0,
      avgProcessingHours: processingDelay ? Math.round(processingDelay.avg * 10) / 10 : 0,
    };
  }

  /** Répartition des demandes par type de formulaire */
  async byType(user: AuthUser) {
    const scope = this.scopeFilter(user);

    const rows = await this.requestModel.aggregate([
      { $match: scope },
      {
        $group: {
          _id: '$requestType',
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $in: ['$status', UNDECIDED_STATUSES] }, 1, 0] },
          },
          rejected: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [RequestStatus.REJECTED, RequestStatus.REJECTED_TECHNICAL],
                  ],
                },
                1,
                0,
              ],
            },
          },
          executed: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [RequestStatus.ACTIVATED, RequestStatus.CLOSED, RequestStatus.EXPIRED],
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const byId = new Map<string, any>(rows.map((row) => [row._id, row]));

    return Object.values(RequestType).map((requestType) => {
      const row = byId.get(requestType);
      return {
        requestType,
        total: row?.total ?? 0,
        pending: row?.pending ?? 0,
        rejected: row?.rejected ?? 0,
        executed: row?.executed ?? 0,
      };
    });
  }

  async byDepartment(user: AuthUser) {
    const scope = this.scopeFilter(user);

    const rows = await this.requestModel.aggregate([
      { $match: scope },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', RequestStatus.PENDING_MANAGER] }, 1, 0] },
          },
          approved: {
            $sum: { $cond: [{ $in: ['$status', APPROVED_SIDE_STATUSES] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', RequestStatus.REJECTED] }, 1, 0] },
          },
          activated: {
            $sum: { $cond: [{ $eq: ['$status', RequestStatus.ACTIVATED] }, 1, 0] },
          },
        },
      },
    ]);
    const byId = new Map<string, any>(rows.map((row) => [row._id.toString(), row]));

    const departmentFilter =
      user.role === Role.MANAGER && user.departmentId
        ? { _id: new Types.ObjectId(user.departmentId) }
        : {};
    const departments = await this.departmentModel.find(departmentFilter).sort({ name: 1 });

    return departments
      .map((department) => {
        const row = byId.get(department._id.toString());
        return {
          departmentId: department._id.toString(),
          departmentName: department.name,
          total: row?.total ?? 0,
          pending: row?.pending ?? 0,
          approved: row?.approved ?? 0,
          rejected: row?.rejected ?? 0,
          activated: row?.activated ?? 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  async monthly(user: AuthUser, months: number) {
    const scope = this.scopeFilter(user);
    const start = new Date();
    start.setMonth(start.getMonth() - (months - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const [createdRows, decidedRows] = await Promise.all([
      this.requestModel.aggregate([
        { $match: { ...scope, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            created: { $sum: 1 },
          },
        },
      ]),
      this.requestModel.aggregate([
        {
          $match: {
            ...scope,
            managerDecisionAt: { $ne: null, $gte: start },
            // Une demande « modifications demandées » n'est pas encore tranchée
            status: { $nin: UNDECIDED_STATUSES },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$managerDecisionAt' } },
            approved: {
              $sum: { $cond: [{ $ne: ['$status', RequestStatus.REJECTED] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', RequestStatus.REJECTED] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const createdByMonth = new Map(createdRows.map((row) => [row._id, row.created]));
    const decidedByMonth = new Map(decidedRows.map((row) => [row._id, row]));

    const result: { month: string; created: number; approved: number; rejected: number }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < months; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const decided = decidedByMonth.get(key);
      result.push({
        month: key,
        created: createdByMonth.get(key) ?? 0,
        approved: decided?.approved ?? 0,
        rejected: decided?.rejected ?? 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }
}

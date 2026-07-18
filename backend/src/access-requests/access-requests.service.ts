import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AccessType,
  AuditAction,
  DurationType,
  NETWORK_QUEUE_STATUSES,
  NotificationType,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_PREFIXES,
  RequestStatus,
  RequestType,
  Role,
} from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../common/interfaces/paginated-result.interface';
import { escapeRegex } from '../common/utils/regex.util';
import { DecisionHelperService } from '../decision-helper/decision-helper.service';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { CloseRequestDto } from './dto/close-request.dto';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { ProcessRequestDto } from './dto/process-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { RequestChangesDto } from './dto/request-changes.dto';
import { RequestQueryDto } from './dto/request-query.dto';
import { UpdateAccessRequestDto } from './dto/update-access-request.dto';
import { validateFormData } from './form-definitions';
import { AccessRequest, AccessRequestDocument } from './schemas/access-request.schema';
import { RequestHistory, RequestHistoryDocument } from './schemas/request-history.schema';

const POPULATE = [
  { path: 'requester', select: 'firstName lastName email matricule' },
  { path: 'department', select: 'name code' },
  { path: 'service', select: 'name' },
  { path: 'managerDecisionBy', select: 'firstName lastName' },
  { path: 'processedBy', select: 'firstName lastName' },
];

/** Justification par défaut de la fiche d'engagement (formulaire sans motif libre) */
const PASSWORD_COMMITMENT_JUSTIFICATION =
  'Engagement de confidentialité relatif au mot de passe professionnel.';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AccessRequestsService {
  constructor(
    @InjectModel(AccessRequest.name)
    private readonly requestModel: Model<AccessRequestDocument>,
    @InjectModel(RequestHistory.name)
    private readonly historyModel: Model<RequestHistoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
    private readonly decisionHelper: DecisionHelperService,
  ) {}

  // ------------------------------------------------------------------
  // Création
  // ------------------------------------------------------------------

  async create(
    authUser: AuthUser,
    dto: CreateAccessRequestDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    // L'identité vient TOUJOURS du profil serveur, jamais du client
    const requester = await this.userModel.findById(authUser.userId).exec();
    if (!requester) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    if (!requester.department) {
      throw new BadRequestException(
        "Votre compte n'est rattaché à aucun département. Contactez l'administrateur.",
      );
    }
    const department = await this.departmentModel.findById(requester.department).exec();
    if (!department) {
      throw new BadRequestException('Le département de votre profil est introuvable.');
    }

    const content = this.validateRequestContent(dto.requestType, dto);
    const serviceId = await this.resolveService(dto.serviceId, requester, department);

    const previousRejectedCount = await this.requestModel.countDocuments({
      requester: requester._id,
      status: { $in: [RequestStatus.REJECTED, RequestStatus.REJECTED_TECHNICAL] },
    });

    const decisionSupport = this.decisionHelper.evaluate({
      requestType: dto.requestType,
      justification: content.justification,
      accessType: content.accessType,
      durationType: content.durationType,
      durationDays: content.durationDays,
      departmentName: department.name,
      formData: content.formData,
      previousRejectedCount,
    });

    const payload = {
      requestType: dto.requestType,
      requester: requester._id,
      firstName: requester.firstName,
      lastName: requester.lastName,
      matricule: requester.matricule,
      email: requester.email,
      position: dto.position?.trim() || requester.position,
      department: department._id,
      service: serviceId,
      accessType: content.accessType,
      durationType: content.durationType,
      durationDays: content.durationDays,
      justification: content.justification,
      formData: content.formData,
      status: RequestStatus.PENDING_MANAGER,
      decisionSupport,
    };

    let created: AccessRequestDocument;
    try {
      created = await this.requestModel.create({
        ...payload,
        reference: await this.generateReference(dto.requestType),
      });
    } catch (error: any) {
      if (error?.code !== 11000) {
        throw error;
      }
      // Deux créations simultanées ont produit la même référence :
      // on retente avec un suffixe horodaté, garanti unique
      const prefix = REQUEST_TYPE_PREFIXES[dto.requestType];
      created = await this.requestModel.create({
        ...payload,
        reference: `REQ-${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      });
    }
    const reference = created.reference;

    const typeLabel = REQUEST_TYPE_LABELS[dto.requestType];

    await this.addHistory(created._id, {
      action: `Demande créée — ${typeLabel}`,
      fromStatus: null,
      toStatus: RequestStatus.PENDING_MANAGER,
      performedBy: requester._id,
    });

    await this.notifyManagerOfDepartment(department, {
      type: NotificationType.REQUEST_SUBMITTED,
      title: 'Nouvelle demande à valider',
      message: `${requester.firstName} ${requester.lastName} a soumis « ${typeLabel} » (${reference}, département ${department.name}).`,
      requestId: created._id,
    });

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_CREATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        reference,
        typeFormulaire: dto.requestType,
        durationType: content.durationType,
      },
    });

    return this.findByIdOrFail(created._id.toString());
  }

  // ------------------------------------------------------------------
  // Re-soumission après demande de modification
  // ------------------------------------------------------------------

  async resubmit(
    id: string,
    authUser: AuthUser,
    dto: UpdateAccessRequestDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);

    if (this.requesterId(request).toString() !== authUser.userId) {
      throw new ForbiddenException('Seul l’auteur de la demande peut la modifier.');
    }
    if (request.status !== RequestStatus.CHANGES_REQUESTED) {
      throw new BadRequestException(
        'Cette demande ne peut être modifiée que lorsque le chef a demandé des modifications.',
      );
    }

    const content = this.validateRequestContent(request.requestType, {
      accessType: dto.accessType ?? request.accessType ?? undefined,
      durationType: dto.durationType ?? request.durationType,
      durationDays: dto.durationDays ?? request.durationDays ?? undefined,
      justification: dto.justification ?? request.justification,
      formData: dto.formData ?? (request.formData as Record<string, unknown>),
    });

    const serviceId = dto.serviceId
      ? await this.resolveService(
          dto.serviceId,
          null,
          await this.departmentModel.findById(this.departmentId(request)).exec(),
        )
      : request.service;

    const previousRejectedCount = await this.requestModel.countDocuments({
      requester: this.requesterId(request),
      status: { $in: [RequestStatus.REJECTED, RequestStatus.REJECTED_TECHNICAL] },
    });

    const department = await this.departmentModel.findById(this.departmentId(request)).exec();

    request.accessType = content.accessType;
    request.durationType = content.durationType;
    request.durationDays = content.durationDays;
    request.justification = content.justification;
    request.formData = content.formData;
    request.markModified('formData'); // champ Mixed : forcer la détection du changement
    if (dto.position?.trim()) {
      request.position = dto.position.trim();
    }
    request.service = serviceId as Types.ObjectId | null;
    request.decisionSupport = this.decisionHelper.evaluate({
      requestType: request.requestType,
      justification: content.justification,
      accessType: content.accessType,
      durationType: content.durationType,
      durationDays: content.durationDays,
      departmentName: department?.name,
      formData: content.formData,
      previousRejectedCount,
    });
    // Remise à zéro de la décision précédente : la demande repart au début
    // du circuit (sinon le PDF afficherait une décision qui n'existe plus)
    request.managerDecisionBy = null;
    request.managerDecisionAt = null;
    request.managerComment = '';
    request.rejectionReason = '';
    request.status = RequestStatus.PENDING_MANAGER;
    await request.save();

    await this.addHistory(request._id, {
      action: 'Demande modifiée et re-soumise par l’employé',
      fromStatus: RequestStatus.CHANGES_REQUESTED,
      toStatus: RequestStatus.PENDING_MANAGER,
      performedBy: new Types.ObjectId(authUser.userId),
      comment: dto.resubmitComment,
    });

    if (department) {
      await this.notifyManagerOfDepartment(department, {
        type: NotificationType.REQUEST_RESUBMITTED,
        title: 'Demande modifiée et re-soumise',
        message: `${request.firstName} ${request.lastName} a mis à jour la demande ${request.reference} suite à votre demande de modification.`,
        requestId: request._id,
      });
    }

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_RESUBMITTED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference },
    });

    return this.findByIdOrFail(id);
  }

  // ------------------------------------------------------------------
  // Lecture
  // ------------------------------------------------------------------

  async findMy(
    authUser: AuthUser,
    query: RequestQueryDto,
  ): Promise<PaginatedResult<AccessRequestDocument>> {
    const filter: Record<string, any> = {
      requester: new Types.ObjectId(authUser.userId),
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.requestType) {
      filter.requestType = query.requestType;
    }
    return this.paginate(filter, query);
  }

  async findAll(
    authUser: AuthUser,
    query: RequestQueryDto,
  ): Promise<PaginatedResult<AccessRequestDocument>> {
    const filter: Record<string, any> = {};

    switch (authUser.role) {
      case Role.ADMIN:
      case Role.SECURITY_OFFICER:
        if (query.department) {
          filter.department = new Types.ObjectId(query.department);
        }
        if (query.status) {
          filter.status = query.status;
        }
        break;
      case Role.MANAGER:
        if (!authUser.departmentId) {
          throw new ForbiddenException("Votre compte n'est rattaché à aucun département.");
        }
        filter.department = new Types.ObjectId(authUser.departmentId);
        if (query.status) {
          filter.status = query.status;
        }
        break;
      case Role.NETWORK_TEAM:
        // L'équipe réseau ne voit que la file post-validation
        if (query.status) {
          filter.status = NETWORK_QUEUE_STATUSES.includes(query.status)
            ? query.status
            : '__none__';
        } else {
          filter.status = { $in: NETWORK_QUEUE_STATUSES };
        }
        break;
      default:
        throw new ForbiddenException('Utilisez /access-requests/my pour vos propres demandes.');
    }

    if (query.requestType) {
      filter.requestType = query.requestType;
    }
    if (query.search) {
      const regex = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [
        { reference: regex },
        { firstName: regex },
        { lastName: regex },
        { matricule: regex },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) {
        filter.createdAt.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    return this.paginate(filter, query);
  }

  async findOne(id: string, authUser: AuthUser): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertCanView(request, authUser);
    return request;
  }

  async getHistory(id: string, authUser: AuthUser): Promise<RequestHistoryDocument[]> {
    const request = await this.findByIdOrFail(id);
    this.assertCanView(request, authUser);
    return this.historyModel
      .find({ request: request._id })
      .sort({ createdAt: 1 })
      .populate('performedBy', 'firstName lastName')
      .exec();
  }

  // ------------------------------------------------------------------
  // Décision du chef de département
  // ------------------------------------------------------------------

  async approve(
    id: string,
    authUser: AuthUser,
    dto: ApproveRequestDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertManagerCanDecide(request, authUser);

    request.status = RequestStatus.APPROVED_BY_MANAGER;
    request.managerDecisionBy = new Types.ObjectId(authUser.userId);
    request.managerDecisionAt = new Date();
    request.managerComment = dto.comment?.trim() || '';
    await request.save();

    await this.addHistory(request._id, {
      action: 'Demande acceptée par le chef de département',
      fromStatus: RequestStatus.PENDING_MANAGER,
      toStatus: RequestStatus.APPROVED_BY_MANAGER,
      performedBy: new Types.ObjectId(authUser.userId),
      comment: dto.comment,
    });

    const typeLabel = REQUEST_TYPE_LABELS[request.requestType];
    await this.notifications.notify({
      recipientId: this.requesterId(request),
      type: NotificationType.REQUEST_APPROVED,
      title: 'Demande acceptée',
      message: `Votre demande ${request.reference} (${typeLabel}) a été acceptée par le chef de département. Elle est transmise à l'équipe réseau pour vérification technique.`,
      relatedRequestId: request._id,
    });
    const networkUsers = await this.userModel
      .find({ role: Role.NETWORK_TEAM, isActive: true })
      .exec();
    await this.notifications.notifyMany(
      networkUsers.map((user) => user._id),
      {
        type: NotificationType.REQUEST_APPROVED,
        title: 'Nouvelle demande à traiter',
        message: `La demande ${request.reference} (${typeLabel} — ${request.firstName} ${request.lastName}) a été validée et attend une vérification technique.`,
        relatedRequestId: request._id,
      },
    );

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_APPROVED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference },
    });

    return this.findByIdOrFail(id);
  }

  async reject(
    id: string,
    authUser: AuthUser,
    dto: RejectRequestDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertManagerCanDecide(request, authUser);

    request.status = RequestStatus.REJECTED;
    request.managerDecisionBy = new Types.ObjectId(authUser.userId);
    request.managerDecisionAt = new Date();
    request.rejectionReason = dto.reason.trim();
    request.managerComment = dto.comment?.trim() || '';
    await request.save();

    await this.addHistory(request._id, {
      action: 'Demande refusée par le chef de département',
      fromStatus: RequestStatus.PENDING_MANAGER,
      toStatus: RequestStatus.REJECTED,
      performedBy: new Types.ObjectId(authUser.userId),
      comment: dto.reason,
    });

    await this.notifications.notify({
      recipientId: this.requesterId(request),
      type: NotificationType.REQUEST_REJECTED,
      title: 'Demande refusée',
      message: `Votre demande ${request.reference} a été refusée. Motif : ${dto.reason}`,
      relatedRequestId: request._id,
    });

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_REJECTED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference, motif: dto.reason },
    });

    return this.findByIdOrFail(id);
  }

  /** Le chef demande une modification ou des informations complémentaires */
  async requestChanges(
    id: string,
    authUser: AuthUser,
    dto: RequestChangesDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertManagerCanDecide(request, authUser);

    request.status = RequestStatus.CHANGES_REQUESTED;
    request.managerDecisionBy = new Types.ObjectId(authUser.userId);
    request.managerDecisionAt = new Date();
    request.managerComment = dto.comment.trim();
    await request.save();

    await this.addHistory(request._id, {
      action: 'Modifications demandées par le chef de département',
      fromStatus: RequestStatus.PENDING_MANAGER,
      toStatus: RequestStatus.CHANGES_REQUESTED,
      performedBy: new Types.ObjectId(authUser.userId),
      comment: dto.comment,
    });

    await this.notifications.notify({
      recipientId: this.requesterId(request),
      type: NotificationType.REQUEST_CHANGES_REQUESTED,
      title: 'Modifications demandées',
      message: `Le chef de département demande des modifications sur votre demande ${request.reference} : ${dto.comment}`,
      relatedRequestId: request._id,
    });

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_CHANGES_REQUESTED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference, commentaire: dto.comment },
    });

    return this.findByIdOrFail(id);
  }

  // ------------------------------------------------------------------
  // Traitement par l'équipe réseau (2e vérification technique)
  // ------------------------------------------------------------------

  async startProcessing(
    id: string,
    authUser: AuthUser,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertStatus(request, [
      RequestStatus.APPROVED_BY_MANAGER,
      RequestStatus.PENDING_NETWORK,
    ]);
    this.assertNotOwnRequest(request, authUser);

    const fromStatus = request.status;
    request.status = RequestStatus.IN_PROGRESS_NETWORK;
    request.processedBy = new Types.ObjectId(authUser.userId);
    await request.save();

    await this.addHistory(request._id, {
      action: "Demande prise en charge par l'équipe réseau",
      fromStatus,
      toStatus: RequestStatus.IN_PROGRESS_NETWORK,
      performedBy: new Types.ObjectId(authUser.userId),
    });

    await this.notifications.notify({
      recipientId: this.requesterId(request),
      type: NotificationType.REQUEST_IN_PROGRESS,
      title: 'Demande en cours de traitement',
      message: `Votre demande ${request.reference} est en cours de vérification technique par l'équipe réseau et sécurité.`,
      relatedRequestId: request._id,
    });

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_TAKEN_IN_CHARGE,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference },
    });

    return this.findByIdOrFail(id);
  }

  async process(
    id: string,
    authUser: AuthUser,
    dto: ProcessRequestDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertStatus(request, [
      RequestStatus.APPROVED_BY_MANAGER,
      RequestStatus.PENDING_NETWORK,
      RequestStatus.IN_PROGRESS_NETWORK,
    ]);
    this.assertNotOwnRequest(request, authUser);

    const fromStatus = request.status;
    const typeLabel = REQUEST_TYPE_LABELS[request.requestType];
    request.processedBy = new Types.ObjectId(authUser.userId);
    request.processedAt = new Date();
    request.networkComment = dto.networkComment?.trim() || '';
    request.accessActivated = dto.accessActivated;

    if (dto.accessActivated) {
      const activationDate = dto.activationDate ? new Date(dto.activationDate) : new Date();
      let expirationDate: Date | null = dto.expirationDate
        ? new Date(dto.expirationDate)
        : null;
      if (
        !expirationDate &&
        request.durationType === DurationType.TEMPORARY &&
        request.durationDays
      ) {
        expirationDate = new Date(activationDate);
        expirationDate.setDate(expirationDate.getDate() + request.durationDays);
      }
      if (expirationDate && expirationDate <= activationDate) {
        throw new BadRequestException(
          "La date d'expiration doit être postérieure à la date d'activation.",
        );
      }
      request.status = RequestStatus.ACTIVATED;
      request.activationDate = activationDate;
      request.expirationDate = expirationDate;

      await request.save();
      await this.addHistory(request._id, {
        action: this.executionActionLabel(request.requestType),
        fromStatus,
        toStatus: RequestStatus.ACTIVATED,
        performedBy: new Types.ObjectId(authUser.userId),
        comment: dto.networkComment,
      });
      await this.notifications.notify({
        recipientId: this.requesterId(request),
        type: NotificationType.REQUEST_ACTIVATED,
        title: 'Demande exécutée',
        message: expirationDate
          ? `Votre demande ${request.reference} (${typeLabel}) a été exécutée. Validité jusqu'au ${expirationDate.toLocaleDateString('fr-FR')}.`
          : `Votre demande ${request.reference} (${typeLabel}) a été exécutée (validité permanente).`,
        relatedRequestId: request._id,
      });

      await this.auditLogs.record({
        userId: authUser.userId,
        userEmail: authUser.email,
        action: AuditAction.REQUEST_PROCESSED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { reference: request.reference, accesActive: true },
      });
    } else {
      // Refus TECHNIQUE : 2e vérification négative, motif obligatoire
      if (!dto.networkComment?.trim()) {
        throw new BadRequestException(
          'Un motif technique est obligatoire en cas de refus technique.',
        );
      }
      request.status = RequestStatus.REJECTED_TECHNICAL;
      request.closedAt = new Date();

      await request.save();
      await this.addHistory(request._id, {
        action: "Refus technique par l'équipe réseau",
        fromStatus,
        toStatus: RequestStatus.REJECTED_TECHNICAL,
        performedBy: new Types.ObjectId(authUser.userId),
        comment: dto.networkComment,
      });
      await this.notifications.notify({
        recipientId: this.requesterId(request),
        type: NotificationType.REQUEST_REJECTED_TECHNICAL,
        title: 'Refus technique',
        message: `Votre demande ${request.reference} (${typeLabel}) a été refusée lors de la vérification technique. Motif : ${dto.networkComment}`,
        relatedRequestId: request._id,
      });

      await this.auditLogs.record({
        userId: authUser.userId,
        userEmail: authUser.email,
        action: AuditAction.REQUEST_REJECTED_TECHNICAL,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { reference: request.reference, motif: dto.networkComment },
      });
    }

    return this.findByIdOrFail(id);
  }

  async close(
    id: string,
    authUser: AuthUser,
    dto: CloseRequestDto,
    context: RequestContext = {},
  ): Promise<AccessRequestDocument> {
    const request = await this.findByIdOrFail(id);
    this.assertStatus(request, [RequestStatus.ACTIVATED, RequestStatus.EXPIRED]);

    const fromStatus = request.status;
    request.status = RequestStatus.CLOSED;
    request.closedAt = new Date();
    if (dto.comment?.trim()) {
      request.networkComment = dto.comment.trim();
    }
    await request.save();

    await this.addHistory(request._id, {
      action: 'Demande clôturée',
      fromStatus,
      toStatus: RequestStatus.CLOSED,
      performedBy: new Types.ObjectId(authUser.userId),
      comment: dto.comment,
    });

    await this.notifications.notify({
      recipientId: this.requesterId(request),
      type: NotificationType.REQUEST_CLOSED,
      title: 'Demande clôturée',
      message: `Votre demande ${request.reference} a été clôturée par l'équipe réseau.`,
      relatedRequestId: request._id,
    });

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.REQUEST_CLOSED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference },
    });

    return this.findByIdOrFail(id);
  }

  // ------------------------------------------------------------------
  // Helpers internes (également utilisés par la tâche d'expiration)
  // ------------------------------------------------------------------

  async addHistory(
    requestId: Types.ObjectId,
    entry: {
      action: string;
      fromStatus: RequestStatus | null;
      toStatus: RequestStatus;
      performedBy?: Types.ObjectId | null;
      comment?: string;
    },
  ): Promise<void> {
    await this.historyModel.create({
      request: requestId,
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      performedBy: entry.performedBy ?? null,
      comment: entry.comment?.trim() || '',
    });
  }

  async findByIdOrFail(id: string): Promise<AccessRequestDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide.');
    }
    const request = await this.requestModel.findById(id).populate(POPULATE).exec();
    if (!request) {
      throw new NotFoundException('Demande introuvable.');
    }
    return request;
  }

  /** Contrôle d'accès en lecture (réutilisé par l'export PDF) */
  assertCanView(request: AccessRequestDocument, authUser: AuthUser): void {
    const isOwner = this.requesterId(request).toString() === authUser.userId;
    const isAdminOrSecurity =
      authUser.role === Role.ADMIN || authUser.role === Role.SECURITY_OFFICER;
    const isDepartmentManager =
      authUser.role === Role.MANAGER &&
      this.departmentId(request).toString() === authUser.departmentId;
    const isNetworkAllowed =
      authUser.role === Role.NETWORK_TEAM && NETWORK_QUEUE_STATUSES.includes(request.status);

    if (!isOwner && !isAdminOrSecurity && !isDepartmentManager && !isNetworkAllowed) {
      throw new ForbiddenException("Vous n'avez pas accès à cette demande.");
    }
  }

  // ------------------------------------------------------------------
  // Privé
  // ------------------------------------------------------------------

  /**
   * Valide la cohérence du contenu selon le type de formulaire :
   * accessType, durée, justification et champs spécifiques (formData).
   */
  private validateRequestContent(
    requestType: RequestType,
    input: {
      accessType?: AccessType | null;
      durationType: DurationType;
      durationDays?: number | null;
      justification?: string;
      formData?: Record<string, unknown>;
    },
  ): {
    accessType: AccessType | null;
    durationType: DurationType;
    durationDays: number | null;
    justification: string;
    formData: Record<string, unknown>;
  } {
    // Type d'accès Internet : requis uniquement pour le formulaire Internet
    let accessType: AccessType | null = null;
    if (requestType === RequestType.INTERNET_ACCESS) {
      if (!input.accessType) {
        throw new BadRequestException(
          "Le type d'accès (complet, standard, restreint) est obligatoire pour une demande d'accès Internet.",
        );
      }
      accessType = input.accessType;
    }

    // Durée : la fiche d'engagement est toujours permanente
    let durationType = input.durationType;
    let durationDays = input.durationDays ?? null;
    if (requestType === RequestType.PASSWORD_COMMITMENT) {
      durationType = DurationType.PERMANENT;
      durationDays = null;
    } else if (durationType === DurationType.TEMPORARY && !durationDays) {
      throw new BadRequestException(
        'La durée en jours est obligatoire pour une demande temporaire.',
      );
    } else if (durationType === DurationType.PERMANENT) {
      durationDays = null;
    }

    // Justification : obligatoire sauf pour la fiche d'engagement
    let justification = (input.justification ?? '').trim();
    if (!justification) {
      if (requestType === RequestType.PASSWORD_COMMITMENT) {
        justification = PASSWORD_COMMITMENT_JUSTIFICATION;
      } else {
        throw new BadRequestException('La justification du besoin est obligatoire.');
      }
    }

    // Champs spécifiques au formulaire
    const { cleaned, errors } = validateFormData(requestType, input.formData);
    if (errors.length > 0) {
      throw new BadRequestException(errors.map((error) => error.message));
    }

    return { accessType, durationType, durationDays, justification, formData: cleaned };
  }

  private async resolveService(
    serviceId: string | undefined,
    requester: UserDocument | null,
    department: DepartmentDocument | null,
  ): Promise<Types.ObjectId | null> {
    if (!serviceId) {
      return requester?.service ?? null;
    }
    const service = await this.serviceModel.findById(serviceId).exec();
    if (!service) {
      throw new BadRequestException('Le service sélectionné est introuvable.');
    }
    if (department && service.department.toString() !== department._id.toString()) {
      throw new BadRequestException(
        'Le service sélectionné n’appartient pas à votre département.',
      );
    }
    return service._id;
  }

  /** Notifie le chef du département, ou les admins si aucun chef n'est désigné */
  private async notifyManagerOfDepartment(
    department: DepartmentDocument,
    input: {
      type: NotificationType;
      title: string;
      message: string;
      requestId: Types.ObjectId;
    },
  ): Promise<void> {
    if (department.manager) {
      await this.notifications.notify({
        recipientId: department.manager,
        type: input.type,
        title: input.title,
        message: input.message,
        relatedRequestId: input.requestId,
      });
      return;
    }
    const admins = await this.userModel.find({ role: Role.ADMIN, isActive: true }).exec();
    await this.notifications.notifyMany(
      admins.map((admin) => admin._id),
      {
        type: input.type,
        title: `${input.title} (département sans chef)`,
        message: input.message,
        relatedRequestId: input.requestId,
      },
    );
  }

  private async paginate(
    filter: Record<string, any>,
    query: RequestQueryDto,
  ): Promise<PaginatedResult<AccessRequestDocument>> {
    const [data, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .populate(POPULATE)
        .exec(),
      this.requestModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  /** Le champ requester peut être peuplé ou non : renvoie toujours l'ObjectId */
  private requesterId(request: AccessRequestDocument): Types.ObjectId {
    const requester: any = request.requester;
    return requester?._id ?? requester;
  }

  private departmentId(request: AccessRequestDocument): Types.ObjectId {
    const department: any = request.department;
    return department?._id ?? department;
  }

  private assertManagerCanDecide(request: AccessRequestDocument, authUser: AuthUser): void {
    if (request.status !== RequestStatus.PENDING_MANAGER) {
      throw new BadRequestException('Cette demande a déjà été traitée par un chef.');
    }
    // Séparation des tâches : personne ne valide sa propre demande
    if (this.requesterId(request).toString() === authUser.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas valider votre propre demande (séparation des tâches).',
      );
    }
    if (authUser.role === Role.ADMIN) {
      return;
    }
    if (this.departmentId(request).toString() !== authUser.departmentId) {
      throw new ForbiddenException(
        'Vous ne pouvez valider que les demandes de votre département.',
      );
    }
  }

  /** Séparation des tâches côté équipe réseau : on ne traite pas sa propre demande */
  private assertNotOwnRequest(request: AccessRequestDocument, authUser: AuthUser): void {
    if (this.requesterId(request).toString() === authUser.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas traiter techniquement votre propre demande (séparation des tâches).',
      );
    }
  }

  private assertStatus(request: AccessRequestDocument, allowed: RequestStatus[]): void {
    if (!allowed.includes(request.status)) {
      throw new BadRequestException(
        `Action impossible : la demande est au statut ${request.status}.`,
      );
    }
  }

  /** Action inscrite dans l'historique lors de l'exécution technique, selon le type */
  private executionActionLabel(requestType: RequestType): string {
    switch (requestType) {
      case RequestType.INTERNET_ACCESS:
        return 'Accès Internet activé';
      case RequestType.REMOTE_ACCESS:
        return 'Accès à distance configuré';
      case RequestType.EXTERNAL_DRIVE:
        return 'Lecteur externe déverrouillé (autorisation temporaire)';
      case RequestType.NETWORK_SHARE:
        return 'Accès au partage réseau accordé';
      case RequestType.USB_3G_KEY:
        return 'Clé 3G attribuée et activée';
      case RequestType.PASSWORD_COMMITMENT:
        return 'Fiche d’engagement enregistrée';
    }
  }

  private async generateReference(requestType: RequestType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = REQUEST_TYPE_PREFIXES[requestType];
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.requestModel.countDocuments({
        reference: { $regex: `^REQ-${prefix}-${year}-` },
      });
      const reference = `REQ-${prefix}-${year}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.requestModel.findOne({ reference });
      if (!exists) {
        return reference;
      }
    }
    // Dernier recours : suffixe horodaté, toujours unique
    return `REQ-${prefix}-${year}-${Date.now().toString().slice(-6)}`;
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  AccessRequest,
  AccessRequestDocument,
} from '../access-requests/schemas/access-request.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  MESSAGING_ROLES,
  NETWORK_QUEUE_STATUSES,
  NotificationType,
  Role,
  ThreadStatus,
} from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../common/interfaces/paginated-result.interface';
import { escapeRegex } from '../common/utils/regex.util';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';
import { RequestMessage, RequestMessageDocument } from './schemas/request-message.schema';
import { RequestThread, RequestThreadDocument } from './schemas/request-thread.schema';

const PREVIEW_LENGTH = 140;
const MAX_MESSAGES_PER_THREAD = 500;

const POPULATE_THREAD = [
  { path: 'lastMessageBy', select: 'firstName lastName role' },
  { path: 'department', select: 'name code' },
  { path: 'resolvedBy', select: 'firstName lastName' },
];

export interface ThreadView {
  thread: RequestThreadDocument | null;
  messages: RequestMessageDocument[];
  request: {
    _id: string;
    reference: string;
    requestType: string;
    status: string;
    requesterName: string;
    departmentName: string;
  };
  /** Correspondant attendu côté interlocuteur (affichage) */
  counterpart: 'MANAGER' | 'NETWORK_TEAM';
}

/**
 * Messagerie interne de traitement.
 *
 * Strictement réservée au **chef du département concerné** et à l'**équipe
 * réseau**, et uniquement à partir de la validation du chef : c'est le moment
 * où les deux acteurs collaborent réellement sur une demande. Les employés,
 * administrateurs et responsables sécurité n'y ont aucun accès (le journal
 * d'audit trace l'existence des échanges, jamais leur contenu).
 */
@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(RequestThread.name)
    private readonly threadModel: Model<RequestThreadDocument>,
    @InjectModel(RequestMessage.name)
    private readonly messageModel: Model<RequestMessageDocument>,
    @InjectModel(AccessRequest.name)
    private readonly requestModel: Model<AccessRequestDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  // ------------------------------------------------------------------
  // Liste des fils
  // ------------------------------------------------------------------

  async findThreads(
    authUser: AuthUser,
    query: ThreadQueryDto,
  ): Promise<PaginatedResult<RequestThreadDocument>> {
    this.assertMessagingRole(authUser);
    const filter: FilterQuery<RequestThreadDocument> = this.scopeFilter(authUser);

    if (query.status) {
      filter.status = query.status;
    }
    if (query.requestType) {
      filter.requestType = query.requestType;
    }
    if (query.search) {
      const regex = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [{ reference: regex }, { requesterName: regex }];
    }
    if (query.unreadOnly) {
      const unreadThreadIds = await this.messageModel.distinct('thread', {
        ...this.scopeFilter(authUser),
        author: { $ne: new Types.ObjectId(authUser.userId) },
        readBy: { $ne: new Types.ObjectId(authUser.userId) },
      });
      filter._id = { $in: unreadThreadIds };
    }

    const [data, total] = await Promise.all([
      this.threadModel
        .find(filter)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .populate(POPULATE_THREAD)
        .exec(),
      this.threadModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  /** Nombre de messages non lus adressés à l'utilisateur (badge de navigation) */
  async unreadCount(authUser: AuthUser): Promise<number> {
    if (!MESSAGING_ROLES.includes(authUser.role)) {
      return 0;
    }
    if (authUser.role === Role.MANAGER && !authUser.departmentId) {
      return 0;
    }
    return this.messageModel.countDocuments({
      ...this.scopeFilter(authUser),
      author: { $ne: new Types.ObjectId(authUser.userId) },
      readBy: { $ne: new Types.ObjectId(authUser.userId) },
    });
  }

  /** Identifiants des fils comportant au moins un message non lu */
  async unreadThreadIds(authUser: AuthUser): Promise<string[]> {
    if (!MESSAGING_ROLES.includes(authUser.role)) {
      return [];
    }
    if (authUser.role === Role.MANAGER && !authUser.departmentId) {
      return [];
    }
    const ids = await this.messageModel.distinct('thread', {
      ...this.scopeFilter(authUser),
      author: { $ne: new Types.ObjectId(authUser.userId) },
      readBy: { $ne: new Types.ObjectId(authUser.userId) },
    });
    return ids.map((id) => id.toString());
  }

  // ------------------------------------------------------------------
  // Consultation d'un fil
  // ------------------------------------------------------------------

  /** Fil d'une demande (créé à la volée seulement lors du premier message) */
  async getThreadForRequest(requestId: string, authUser: AuthUser): Promise<ThreadView> {
    const request = await this.resolveAccessibleRequest(requestId, authUser);
    const thread = await this.threadModel
      .findOne({ request: request._id })
      .populate(POPULATE_THREAD)
      .exec();

    let messages: RequestMessageDocument[] = [];
    if (thread) {
      messages = await this.messageModel
        .find({ thread: thread._id })
        .sort({ createdAt: 1 })
        .limit(MAX_MESSAGES_PER_THREAD)
        .populate('author', 'firstName lastName role')
        .exec();
      await this.markThreadAsRead(thread._id, authUser);
    }

    const department: any = request.department;
    return {
      thread,
      messages,
      request: {
        _id: request._id.toString(),
        reference: request.reference,
        requestType: request.requestType,
        status: request.status,
        requesterName: `${request.firstName} ${request.lastName}`,
        departmentName: department?.name ?? '—',
      },
      counterpart: authUser.role === Role.MANAGER ? 'NETWORK_TEAM' : 'MANAGER',
    };
  }

  // ------------------------------------------------------------------
  // Envoi d'un message
  // ------------------------------------------------------------------

  async postMessage(
    requestId: string,
    authUser: AuthUser,
    dto: CreateMessageDto,
    context: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<ThreadView> {
    const request = await this.resolveAccessibleRequest(requestId, authUser);
    const thread = await this.getOrCreateThread(request, authUser);
    const body = dto.body.trim();
    const authorId = new Types.ObjectId(authUser.userId);

    await this.messageModel.create({
      thread: thread._id,
      request: request._id,
      department: this.departmentId(request),
      author: authorId,
      authorRole: authUser.role,
      body,
      // L'auteur a nécessairement lu son propre message
      readBy: [authorId],
    });

    thread.lastMessageAt = new Date();
    thread.lastMessagePreview =
      body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH)}…` : body;
    thread.lastMessageBy = authorId;
    thread.messageCount += 1;
    // Un nouveau message relance un échange clos
    if (thread.status === ThreadStatus.RESOLVED) {
      thread.status = ThreadStatus.OPEN;
      thread.resolvedBy = null;
      thread.resolvedAt = null;
    }
    await thread.save();

    await this.notifyCounterpart(request, thread, authUser, body);

    // Seule l'existence de l'échange est journalisée, jamais son contenu
    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: AuditAction.MESSAGE_SENT,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: request.reference, taille: body.length },
    });

    return this.getThreadForRequest(requestId, authUser);
  }

  // ------------------------------------------------------------------
  // Suivi : résolution / réouverture
  // ------------------------------------------------------------------

  async setResolved(
    threadId: string,
    authUser: AuthUser,
    resolved: boolean,
    context: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<RequestThreadDocument> {
    this.assertMessagingRole(authUser);
    if (!Types.ObjectId.isValid(threadId)) {
      throw new BadRequestException('Identifiant de fil invalide.');
    }
    const thread = await this.threadModel.findById(threadId).exec();
    if (!thread) {
      throw new NotFoundException('Fil de discussion introuvable.');
    }
    // Le contrôle d'accès s'appuie sur la demande rattachée
    await this.resolveAccessibleRequest(thread.request.toString(), authUser);

    if (resolved && thread.status === ThreadStatus.RESOLVED) {
      throw new BadRequestException('Cet échange est déjà marqué comme traité.');
    }
    thread.status = resolved ? ThreadStatus.RESOLVED : ThreadStatus.OPEN;
    thread.resolvedBy = resolved ? new Types.ObjectId(authUser.userId) : null;
    thread.resolvedAt = resolved ? new Date() : null;
    await thread.save();

    await this.auditLogs.record({
      userId: authUser.userId,
      userEmail: authUser.email,
      action: resolved ? AuditAction.THREAD_RESOLVED : AuditAction.THREAD_REOPENED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { reference: thread.reference },
    });

    return this.threadModel.findById(thread._id).populate(POPULATE_THREAD).exec() as Promise<RequestThreadDocument>;
  }

  // ------------------------------------------------------------------
  // Contrôle d'accès
  // ------------------------------------------------------------------

  private assertMessagingRole(authUser: AuthUser): void {
    if (!MESSAGING_ROLES.includes(authUser.role)) {
      throw new ForbiddenException(
        'La messagerie interne est réservée aux chefs de département et à l’équipe réseau.',
      );
    }
  }

  /**
   * Vérifie que l'utilisateur a le droit d'échanger sur cette demande :
   * rôle autorisé, demande parvenue à l'étape réseau, département concerné
   * pour un chef, et jamais sur sa propre demande (séparation des tâches).
   */
  private async resolveAccessibleRequest(
    requestId: string,
    authUser: AuthUser,
  ): Promise<AccessRequestDocument> {
    this.assertMessagingRole(authUser);
    if (!Types.ObjectId.isValid(requestId)) {
      throw new BadRequestException('Identifiant de demande invalide.');
    }
    const request = await this.requestModel
      .findById(requestId)
      .populate({ path: 'department', select: 'name code manager' })
      .exec();
    if (!request) {
      throw new NotFoundException('Demande introuvable.');
    }
    if (!NETWORK_QUEUE_STATUSES.includes(request.status)) {
      throw new ForbiddenException(
        'Les échanges internes s’ouvrent après la validation du chef de département.',
      );
    }
    if (this.requesterId(request).toString() === authUser.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas échanger sur votre propre demande (séparation des tâches).',
      );
    }
    if (authUser.role === Role.MANAGER) {
      if (!authUser.departmentId) {
        throw new ForbiddenException("Votre compte n'est rattaché à aucun département.");
      }
      if (this.departmentId(request).toString() !== authUser.departmentId) {
        throw new ForbiddenException(
          'Vous ne pouvez échanger que sur les demandes de votre département.',
        );
      }
    }
    return request;
  }

  /**
   * Restreint la portée des requêtes au périmètre de l'utilisateur.
   * Les fils comme les messages portent le département de la demande :
   * un chef ne voit que son département, l'équipe réseau voit toute la file.
   */
  private scopeFilter(authUser: AuthUser): FilterQuery<any> {
    if (authUser.role !== Role.MANAGER) {
      return {};
    }
    if (!authUser.departmentId) {
      throw new ForbiddenException("Votre compte n'est rattaché à aucun département.");
    }
    return { department: new Types.ObjectId(authUser.departmentId) };
  }

  private async getOrCreateThread(
    request: AccessRequestDocument,
    authUser: AuthUser,
  ): Promise<RequestThreadDocument> {
    const existing = await this.threadModel.findOne({ request: request._id }).exec();
    if (existing) {
      return existing;
    }
    try {
      return await this.threadModel.create({
        request: request._id,
        reference: request.reference,
        requestType: request.requestType,
        department: this.departmentId(request),
        requesterName: `${request.firstName} ${request.lastName}`,
        status: ThreadStatus.OPEN,
        createdBy: new Types.ObjectId(authUser.userId),
        messageCount: 0,
      });
    } catch (error: any) {
      // Deux premiers messages simultanés : le fil vient d'être créé par l'autre appel
      if (error?.code === 11000) {
        const thread = await this.threadModel.findOne({ request: request._id }).exec();
        if (thread) return thread;
      }
      throw error;
    }
  }

  private async markThreadAsRead(threadId: Types.ObjectId, authUser: AuthUser): Promise<void> {
    const userId = new Types.ObjectId(authUser.userId);
    await this.messageModel.updateMany(
      { thread: threadId, author: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    );
  }

  /**
   * Notifie l'interlocuteur : le chef du département si le message vient de
   * l'équipe réseau, sinon tous les membres actifs de l'équipe réseau.
   */
  private async notifyCounterpart(
    request: AccessRequestDocument,
    thread: RequestThreadDocument,
    author: AuthUser,
    body: string,
  ): Promise<void> {
    const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body;
    const authorName = `${author.firstName} ${author.lastName}`;

    if (author.role === Role.MANAGER) {
      const networkUsers = await this.userModel
        .find({ role: Role.NETWORK_TEAM, isActive: true, _id: { $ne: author.userId } })
        .exec();
      await this.notifications.notifyMany(
        networkUsers.map((user) => user._id),
        {
          type: NotificationType.MESSAGE_RECEIVED,
          title: `Message du chef de département — ${thread.reference}`,
          message: `${authorName} : « ${preview} »`,
          relatedRequestId: request._id,
        },
      );
      return;
    }

    const department = await this.departmentModel.findById(this.departmentId(request)).exec();
    const managerId = department?.manager;
    // Pas de notification si le chef est lui-même le demandeur (il n'a pas accès au fil)
    if (!managerId || managerId.toString() === this.requesterId(request).toString()) {
      return;
    }
    await this.notifications.notify({
      recipientId: managerId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: `Message de l'équipe réseau — ${thread.reference}`,
      message: `${authorName} : « ${preview} »`,
      relatedRequestId: request._id,
    });
  }

  private requesterId(request: AccessRequestDocument): Types.ObjectId {
    const requester: any = request.requester;
    return requester?._id ?? requester;
  }

  private departmentId(request: AccessRequestDocument): Types.ObjectId {
    const department: any = request.department;
    return department?._id ?? department;
  }
}

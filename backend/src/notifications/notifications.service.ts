import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationType } from '../common/enums';
import { buildPaginatedResult, PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { Notification, NotificationDocument } from './schemas/notification.schema';

export interface NotifyInput {
  recipientId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedRequestId?: string | Types.ObjectId | null;
}

/** Lien d'accès temporaire adressé à un employé dont le compte vient d'être créé */
export interface AccountInvitationInput {
  email: string;
  firstName: string;
  lastName: string;
  activationUrl: string;
  expiresAt: Date;
  /** true = redéfinition du mot de passe d'un compte déjà activé */
  isReset: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  /** Crée une notification interne pour un destinataire */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.notificationModel.create({
        recipient: new Types.ObjectId(input.recipientId),
        type: input.type,
        title: input.title,
        message: input.message,
        relatedRequest: input.relatedRequestId
          ? new Types.ObjectId(input.relatedRequestId)
          : null,
      });
      await this.dispatchEmail(input);
    } catch (error) {
      // Une notification qui échoue ne doit jamais bloquer le workflow métier
      this.logger.error(`Échec de création de notification : ${error}`);
    }
  }

  /** Crée la même notification pour plusieurs destinataires (ex : équipe réseau) */
  async notifyMany(recipientIds: (string | Types.ObjectId)[], input: Omit<NotifyInput, 'recipientId'>): Promise<void> {
    await Promise.all(
      recipientIds.map((recipientId) => this.notify({ ...input, recipientId })),
    );
  }

  /**
   * Point d'extension pour l'envoi d'emails.
   * Architecture prête pour Nodemailer : brancher ici un transport SMTP
   * (voir README, section "Évolutions prévues").
   */
  private async dispatchEmail(input: NotifyInput): Promise<void> {
    this.logger.debug(
      `[EMAIL simulé] → destinataire ${input.recipientId} | ${input.title} : ${input.message}`,
    );
  }

  /**
   * Envoi du lien d'accès temporaire à un nouvel employé (ou réinitialisation).
   *
   * Le compte n'existe pas encore côté session : aucune notification interne
   * n'est créée, le lien part par email. Tant qu'aucun transport SMTP n'est
   * configuré, la personne habilitée transmet le lien affiché à l'écran.
   */
  async dispatchAccountInvitation(input: AccountInvitationInput): Promise<void> {
    const objet = input.isReset
      ? 'Réinitialisation de votre mot de passe'
      : 'Activation de votre compte — Portail des accès Poulina';
    this.logger.debug(
      `[EMAIL simulé] → ${input.email} | ${objet} : lien valable jusqu'au ` +
        `${input.expiresAt.toLocaleString('fr-FR')} — ${input.activationUrl}`,
    );
  }

  async findForUser(
    userId: string,
    options: { page: number; limit: number; unreadOnly?: boolean },
  ): Promise<PaginatedResult<NotificationDocument>> {
    const filter: Record<string, any> = { recipient: new Types.ObjectId(userId) };
    if (options.unreadOnly) {
      filter.isRead = false;
    }
    const skip = (options.page - 1) * options.limit;
    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .populate('relatedRequest', 'reference status')
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(data, total, options.page, options.limit);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id, recipient: new Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationModel.updateMany(
      { recipient: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { updated: result.modifiedCount };
  }
}

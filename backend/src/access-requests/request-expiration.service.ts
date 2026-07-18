import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  NotificationType,
  REQUEST_TYPE_LABELS,
  RequestStatus,
} from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequest, AccessRequestDocument } from './schemas/access-request.schema';

const REMINDER_WINDOW_DAYS = 7;

/**
 * Tâche planifiée de gouvernance des accès :
 * - passe au statut EXPIRED les accès arrivés à échéance ;
 * - envoie un rappel à l'employé 7 jours avant l'expiration.
 */
@Injectable()
export class RequestExpirationService implements OnModuleInit {
  private readonly logger = new Logger(RequestExpirationService.name);

  constructor(
    @InjectModel(AccessRequest.name)
    private readonly requestModel: Model<AccessRequestDocument>,
    private readonly accessRequests: AccessRequestsService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.handleExpirations();
    } catch (error) {
      this.logger.error(`Contrôle d'expiration au démarrage impossible : ${error}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpirations(): Promise<void> {
    await this.expireOverdueRequests();
    await this.sendExpiryReminders();
  }

  private async expireOverdueRequests(): Promise<void> {
    const now = new Date();
    const overdue = await this.requestModel
      .find({ status: RequestStatus.ACTIVATED, expirationDate: { $ne: null, $lte: now } })
      .exec();

    for (const request of overdue) {
      request.status = RequestStatus.EXPIRED;
      await request.save();

      await this.accessRequests.addHistory(request._id, {
        action: 'Accès expiré (contrôle automatique)',
        fromStatus: RequestStatus.ACTIVATED,
        toStatus: RequestStatus.EXPIRED,
        performedBy: null,
      });
      await this.notifications.notify({
        recipientId: request.requester,
        type: NotificationType.REQUEST_EXPIRED,
        title: 'Autorisation expirée',
        message: `Votre autorisation ${request.reference} (${REQUEST_TYPE_LABELS[request.requestType]}) est arrivée à expiration. Soumettez une nouvelle demande si nécessaire.`,
        relatedRequestId: request._id,
      });
      await this.auditLogs.record({
        userId: null,
        userEmail: 'système',
        action: AuditAction.REQUEST_EXPIRED,
        details: { reference: request.reference },
      });
      this.logger.log(`Accès expiré : ${request.reference}`);
    }
  }

  private async sendExpiryReminders(): Promise<void> {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + REMINDER_WINDOW_DAYS);

    const expiringSoon = await this.requestModel
      .find({
        status: RequestStatus.ACTIVATED,
        expiryReminderSent: false,
        expirationDate: { $ne: null, $gt: now, $lte: soon },
      })
      .exec();

    for (const request of expiringSoon) {
      await this.notifications.notify({
        recipientId: request.requester,
        type: NotificationType.REQUEST_EXPIRING_SOON,
        title: 'Autorisation bientôt expirée',
        message: `Votre autorisation ${request.reference} (${REQUEST_TYPE_LABELS[request.requestType]}) expire le ${request.expirationDate?.toLocaleDateString('fr-FR')}. Pensez à demander un renouvellement.`,
        relatedRequestId: request._id,
      });
      request.expiryReminderSent = true;
      await request.save();
      this.logger.log(`Rappel d'expiration envoyé : ${request.reference}`);
    }
  }
}

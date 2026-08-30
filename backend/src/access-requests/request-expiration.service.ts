import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, NotificationType, RequestStatus } from '../common/enums';
import { FormDefinitionsService } from '../form-definitions/form-definitions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequest, AccessRequestDocument } from './schemas/access-request.schema';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Seuils de rappel avant expiration, en jours (du plus lointain au plus proche).
 * Un seul rappel part par passage : si plusieurs seuils sont franchis en même
 * temps (accès très court), seul le plus urgent est envoyé et les autres sont
 * marqués comme traités.
 */
export const EXPIRY_REMINDER_THRESHOLDS = [7, 3];

/** Ton du message selon le seuil atteint */
const REMINDER_TONE: Record<number, { title: string; closing: string }> = {
  7: {
    title: 'Autorisation bientôt expirée',
    closing: 'Pensez à demander un renouvellement si le besoin persiste.',
  },
  3: {
    title: 'Dernier rappel — autorisation expirée dans 3 jours',
    closing:
      'Sans renouvellement, l’accès sera automatiquement coupé à l’échéance. Déposez dès maintenant une demande de renouvellement si le besoin persiste.',
  },
};

/**
 * Tâche planifiée de gouvernance des accès :
 * - passe au statut EXPIRED les accès arrivés à échéance ;
 * - envoie deux rappels à l'employé, 7 jours puis 3 jours avant l'expiration.
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
    private readonly formDefinitions: FormDefinitionsService,
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
        message: `Votre autorisation ${request.reference} (${await this.formDefinitions.titleOf(request.requestType)}) est arrivée à expiration. Soumettez une nouvelle demande si nécessaire.`,
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

  /**
   * Envoie les rappels d'expiration (7 jours puis 3 jours avant l'échéance).
   * Chaque seuil n'est notifié qu'une seule fois par demande.
   */
  private async sendExpiryReminders(): Promise<void> {
    const now = new Date();
    const widestThreshold = Math.max(...EXPIRY_REMINDER_THRESHOLDS);
    const horizon = new Date(now.getTime() + widestThreshold * MS_PER_DAY);

    const expiringSoon = await this.requestModel
      .find({
        status: RequestStatus.ACTIVATED,
        expirationDate: { $ne: null, $gt: now, $lte: horizon },
      })
      .exec();

    for (const request of expiringSoon) {
      if (!request.expirationDate) continue;

      const alreadySent = new Set<number>(request.expiryRemindersSent ?? []);
      // Demandes antérieures au second rappel : l'ancien indicateur vaut « 7 jours envoyé »
      if (request.expiryReminderSent) {
        alreadySent.add(7);
      }

      const daysRemaining = Math.max(
        1,
        Math.ceil((request.expirationDate.getTime() - now.getTime()) / MS_PER_DAY),
      );
      const reached = EXPIRY_REMINDER_THRESHOLDS.filter(
        (threshold) => daysRemaining <= threshold,
      );
      const pending = reached.filter((threshold) => !alreadySent.has(threshold));
      if (pending.length === 0) continue;

      // Un seul message, calé sur le seuil le plus urgent effectivement atteint
      const urgentThreshold = Math.min(...pending);
      const tone = REMINDER_TONE[urgentThreshold] ?? REMINDER_TONE[7];
      const typeLabel = await this.formDefinitions.titleOf(request.requestType);
      const dayLabel = daysRemaining > 1 ? `${daysRemaining} jours` : `${daysRemaining} jour`;

      await this.notifications.notify({
        recipientId: request.requester,
        type: NotificationType.REQUEST_EXPIRING_SOON,
        title: tone.title,
        message: `Votre autorisation ${request.reference} (${typeLabel}) expire dans ${dayLabel}, le ${request.expirationDate.toLocaleDateString('fr-FR')}. ${tone.closing}`,
        relatedRequestId: request._id,
      });

      // Les seuils franchis simultanément sont tous marqués : pas de doublon au prochain passage
      request.expiryRemindersSent = [...new Set([...alreadySent, ...reached])].sort(
        (a, b) => b - a,
      );
      request.expiryReminderSent = true;
      await request.save();
      this.logger.log(
        `Rappel d'expiration à ${urgentThreshold} jours envoyé : ${request.reference} (échéance dans ${daysRemaining} j)`,
      );
    }
  }
}

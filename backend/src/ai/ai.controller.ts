import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { Request } from 'express';
import { AccessRequestsService } from '../access-requests/access-requests.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ACCESS_TYPE_LABELS,
  AuditAction,
  DurationType,
  GLOBAL_READ_ROLES,
  REQUESTER_ROLES,
  Role,
} from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { FormDefinitionsService } from '../form-definitions/form-definitions.service';
import { AiService, SUMMARY_THRESHOLD } from './ai.service';
import { ImproveJustificationDto } from './dto/improve-justification.dto';

/**
 * Assistance à la rédaction par IA.
 *
 * Deux usages strictement encadrés :
 *  - l'employé fait reformuler son brouillon de justification ;
 *  - le chef de département fait résumer une justification longue.
 *
 * Aucune décision n'est prise par l'IA : elle ne fait que rédiger ou résumer.
 */
@ApiTags('Assistance à la rédaction')
@ApiBearerAuth('JWT-auth')
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly accessRequests: AccessRequestsService,
    private readonly formDefinitions: FormDefinitionsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Indique si l’assistance IA est configurée (masque les boutons sinon)',
  })
  status() {
    if (!this.ai.isEnabled()) {
      throw new ServiceUnavailableException(
        "L'assistance à la rédaction n'est pas configurée sur ce serveur.",
      );
    }
    return { enabled: this.ai.isEnabled(), summaryThreshold: SUMMARY_THRESHOLD };
  }

  @Post('justification/improve')
  @HttpCode(HttpStatus.OK)
  @Roles(...REQUESTER_ROLES)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reformule le brouillon de justification de l’employé' })
  async improve(
    @Body() dto: ImproveJustificationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const definition = await this.formDefinitions.findByType(dto.requestType);

    const result = await this.ai.improveJustification({
      draft: dto.draft,
      formTitle: definition.title,
      context: {
        accessType: dto.accessType ? ACCESS_TYPE_LABELS[dto.accessType] : undefined,
        duration:
          dto.durationType === DurationType.PERMANENT
            ? 'Permanente'
            : dto.durationDays
              ? `${dto.durationDays} jour(s)`
              : undefined,
      },
    });

    await this.auditLogs.record({
      userId: user.userId,
      userEmail: user.email,
      action: AuditAction.AI_JUSTIFICATION_IMPROVED,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: {
        typeFormulaire: dto.requestType,
        taillePropose: result.improved.length,
        suffisant: result.sufficient,
      },
    });

    return result;
  }

  @Post('access-requests/:id/summary')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.MANAGER, ...GLOBAL_READ_ROLES)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Résume la justification d’une demande (mise en cache sur la demande)',
  })
  async summarize(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const request = await this.accessRequests.findByIdOrFail(id);
    // Même contrôle d'accès que la consultation du détail de la demande
    this.accessRequests.assertCanView(request, user);

    const justification = (request.justification ?? '').trim();
    if (justification.length < SUMMARY_THRESHOLD) {
      throw new BadRequestException(
        'Cette justification est déjà courte : la synthèse n’apporterait rien.',
      );
    }

    const sourceHash = createHash('sha256').update(justification).digest('hex');
    if (request.aiSummary && request.aiSummary.sourceHash === sourceHash) {
      return {
        summary: request.aiSummary.text,
        bullets: request.aiSummary.bullets,
        generatedAt: request.aiSummary.generatedAt,
        cached: true,
      };
    }

    const formTitle = await this.formDefinitions.titleOf(request.requestType);
    const result = await this.ai.summarizeJustification(justification, formTitle);

    const generatedAt = new Date();
    request.aiSummary = {
      text: result.summary,
      bullets: result.bullets,
      sourceHash,
      generatedAt,
    };
    await request.save();

    await this.auditLogs.record({
      userId: user.userId,
      userEmail: user.email,
      action: AuditAction.AI_JUSTIFICATION_SUMMARIZED,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { reference: request.reference },
    });

    return { ...result, generatedAt, cached: false };
  }
}

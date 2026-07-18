import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditAction, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { AccessRequestsService } from './access-requests.service';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { CloseRequestDto } from './dto/close-request.dto';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { ProcessRequestDto } from './dto/process-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { RequestChangesDto } from './dto/request-changes.dto';
import { RequestQueryDto } from './dto/request-query.dto';
import { UpdateAccessRequestDto } from './dto/update-access-request.dto';
import { RequestPdfService } from './request-pdf.service';

@ApiTags("Demandes d'accès")
@ApiBearerAuth('JWT-auth')
@Controller('access-requests')
export class AccessRequestsController {
  constructor(
    private readonly accessRequests: AccessRequestsService,
    private readonly requestPdf: RequestPdfService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Post()
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM)
  @ApiOperation({ summary: "Soumettre une demande d'accès Internet" })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAccessRequestDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.create(user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Get('my')
  @ApiOperation({ summary: "Mes demandes (utilisateur connecté)" })
  findMy(@CurrentUser() user: AuthUser, @Query() query: RequestQueryDto) {
    return this.accessRequests.findMy(user, query);
  }

  @Get()
  @Roles(Role.MANAGER, Role.NETWORK_TEAM, Role.ADMIN, Role.SECURITY_OFFICER)
  @ApiOperation({
    summary:
      'Demandes visibles selon le rôle (chef : son département, réseau : file validée, admin/sécurité : tout)',
  })
  findAll(@CurrentUser() user: AuthUser, @Query() query: RequestQueryDto) {
    return this.accessRequests.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une demande (contrôle d'accès fin)" })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accessRequests.findOne(id, user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: "Historique complet (timeline) d'une demande" })
  history(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accessRequests.getHistory(id, user);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Exporter le formulaire rempli en PDF (contrôle d’accès identique au détail)' })
  async exportPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const request = await this.accessRequests.findOne(id, user);
    const buffer = await this.requestPdf.generate(request);
    await this.auditLogs.record({
      userId: user.userId,
      userEmail: user.email,
      action: AuditAction.REQUEST_PDF_EXPORTED,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { reference: request.reference },
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${request.reference}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Patch(':id/resubmit')
  @ApiOperation({
    summary: 'Modifier et re-soumettre sa demande (auteur, statut « modifications demandées »)',
  })
  resubmit(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAccessRequestDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.resubmit(id, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/request-changes')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Demander une modification / des informations complémentaires (chef)' })
  requestChanges(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestChangesDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.requestChanges(id, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/approve')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Accepter une demande (chef de département)' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApproveRequestDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.approve(id, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/reject')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Refuser une demande avec motif (chef de département)' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectRequestDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.reject(id, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/start-processing')
  @Roles(Role.NETWORK_TEAM, Role.ADMIN)
  @ApiOperation({ summary: 'Prendre en charge une demande validée (équipe réseau)' })
  startProcessing(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.accessRequests.startProcessing(id, user, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/process')
  @Roles(Role.NETWORK_TEAM, Role.ADMIN)
  @ApiOperation({
    summary: 'Traiter une demande : activation (dates) ou clôture sans activation (équipe réseau)',
  })
  process(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ProcessRequestDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.process(id, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/close')
  @Roles(Role.NETWORK_TEAM, Role.ADMIN)
  @ApiOperation({ summary: 'Clôturer une demande activée ou expirée (équipe réseau)' })
  close(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CloseRequestDto,
    @Req() req: Request,
  ) {
    return this.accessRequests.close(id, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

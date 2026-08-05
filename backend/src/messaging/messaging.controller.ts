import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MESSAGING_ROLES } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { CreateMessageDto } from './dto/create-message.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';
import { MessagingService } from './messaging.service';

/**
 * Messagerie interne de traitement des demandes.
 * Accès limité au chef de département et à l'équipe réseau (garde de rôle
 * au niveau du contrôleur + contrôles fins par demande dans le service).
 */
@ApiTags('Messagerie interne')
@ApiBearerAuth('JWT-auth')
@Roles(...MESSAGING_ROLES)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('threads')
  @ApiOperation({ summary: 'Fils de discussion accessibles (filtres statut, type, non lus)' })
  findThreads(@CurrentUser() user: AuthUser, @Query() query: ThreadQueryDto) {
    return this.messaging.findThreads(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de messages non lus (badge de navigation)' })
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { count: await this.messaging.unreadCount(user) };
  }

  @Get('unread-threads')
  @ApiOperation({ summary: 'Identifiants des fils comportant des messages non lus' })
  async unreadThreads(@CurrentUser() user: AuthUser) {
    return { threadIds: await this.messaging.unreadThreadIds(user) };
  }

  @Get('requests/:requestId')
  @ApiOperation({
    summary: 'Fil rattaché à une demande (marque les messages reçus comme lus)',
  })
  getThread(@Param('requestId') requestId: string, @CurrentUser() user: AuthUser) {
    return this.messaging.getThreadForRequest(requestId, user);
  }

  @Post('requests/:requestId/messages')
  @ApiOperation({ summary: 'Envoyer un message au correspondant du traitement' })
  postMessage(
    @Param('requestId') requestId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.messaging.postMessage(requestId, user, dto, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch('threads/:id/resolve')
  @ApiOperation({ summary: 'Marquer l’échange comme traité' })
  resolve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.messaging.setResolved(id, user, true, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch('threads/:id/reopen')
  @ApiOperation({ summary: 'Rouvrir un échange traité' })
  reopen(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.messaging.setResolved(id, user, false, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

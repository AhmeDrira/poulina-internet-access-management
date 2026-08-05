import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@ApiTags('Utilisateurs')
@ApiBearerAuth('JWT-auth')
@Roles(...ADMIN_ROLES)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste paginée des utilisateurs (recherche + filtres)' })
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('summary')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Synthèse des comptes (répartition par rôle, comptes en attente d’activation)',
  })
  async summary() {
    const [byRole, pending] = await Promise.all([
      this.usersService.countByRole(),
      this.usersService.findPendingActivation(),
    ]);
    return { byRole, pendingActivation: pending };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un utilisateur" })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Création d’un compte : aucun mot de passe n’est saisi, un lien d’activation temporaire est renvoyé',
  })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.usersService.create(dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Post(':id/activation-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Génère un lien d’accès temporaire : nouvelle invitation, ou réinitialisation du mot de passe si le compte est déjà activé',
  })
  issueActivationLink(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.usersService.issueActivationLink(id, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mise à jour d’un utilisateur (rôle, affectations...)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.usersService.update(id, dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Réactivation d’un compte' })
  activate(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.usersService.setActive(id, true, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Désactivation d’un compte (bloque la connexion)' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.usersService.setActive(id, false, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Suppression définitive (refusée si le compte est référencé : préférer la désactivation)',
  })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.usersService.remove(id, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

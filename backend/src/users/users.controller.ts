import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@ApiTags('Utilisateurs')
@ApiBearerAuth('JWT-auth')
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste paginée des utilisateurs (recherche + filtres)' })
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un utilisateur" })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Création d’un utilisateur (rôle, département, service)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.usersService.create(dto, {
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
  @ApiOperation({ summary: 'Suppression définitive d’un utilisateur' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.usersService.remove(id, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Départements')
@ApiBearerAuth('JWT-auth')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des départements (tout utilisateur authentifié)' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un département" })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findById(id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Création d’un département (admin)' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.departmentsService.create(dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Mise à jour d’un département — dont le chef responsable (admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.departmentsService.update(id, dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Suppression d’un département (refusée s’il est utilisé)' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.departmentsService.remove(id, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

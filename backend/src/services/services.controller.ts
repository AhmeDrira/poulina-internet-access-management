import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('Services')
@ApiBearerAuth('JWT-auth')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des services (filtrable par département)' })
  @ApiQuery({ name: 'department', required: false, description: 'Identifiant du département' })
  findAll(@Query('department') department?: string) {
    return this.servicesService.findAll(department);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un service" })
  findOne(@Param('id') id: string) {
    return this.servicesService.findById(id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Création d’un service rattaché à un département (admin)' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.servicesService.create(dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Mise à jour d’un service (admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.servicesService.update(id, dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Suppression d’un service (refusée s’il est utilisé)' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.servicesService.remove(id, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

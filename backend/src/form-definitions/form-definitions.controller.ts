import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES, RequestType, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { UpdateFormDefinitionDto } from './dto/update-form-definition.dto';
import { FormDefinitionsService } from './form-definitions.service';

/** Valide le type de formulaire passé dans l'URL */
const RequestTypeParam = new ParseEnumPipe(RequestType, {
  exceptionFactory: () => new BadRequestException('Type de formulaire inconnu.'),
});

@ApiTags('Formulaires')
@ApiBearerAuth('JWT-auth')
@Controller('form-definitions')
export class FormDefinitionsController {
  constructor(private readonly formDefinitions: FormDefinitionsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Définitions des formulaires (les administrateurs voient aussi les formulaires désactivés)',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.formDefinitions.findAll(ADMIN_ROLES.includes(user.role));
  }

  @Get(':type')
  @ApiOperation({ summary: "Définition d'un formulaire" })
  findOne(@Param('type', RequestTypeParam) type: RequestType) {
    return this.formDefinitions.findByType(type);
  }

  @Get(':type/usage')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Nombre de demandes existantes par champ (avant modification du formulaire)',
  })
  async usage(@Param('type', RequestTypeParam) type: RequestType) {
    const [byField, total] = await Promise.all([
      this.formDefinitions.fieldUsage(type),
      this.formDefinitions.requestCount(type),
    ]);
    return { requestType: type, totalRequests: total, byField };
  }

  @Patch(':type')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Modification d’un formulaire (champs, options, consignes)' })
  update(
    @Param('type', RequestTypeParam) type: RequestType,
    @Body() dto: UpdateFormDefinitionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.formDefinitions.update(type, dto, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':type/activate')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remettre le formulaire à disposition des employés' })
  activate(
    @Param('type', RequestTypeParam) type: RequestType,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.formDefinitions.setActive(type, true, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Patch(':type/deactivate')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Retirer le formulaire du catalogue (les demandes existantes sont conservées)',
  })
  deactivate(
    @Param('type', RequestTypeParam) type: RequestType,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.formDefinitions.setActive(type, false, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  @Post(':type/reset')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Réinitialiser le formulaire à sa définition d’origine' })
  reset(
    @Param('type', RequestTypeParam) type: RequestType,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.formDefinitions.reset(type, {
      actor,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags("Journal d'audit")
@ApiBearerAuth('JWT-auth')
@Roles(Role.ADMIN, Role.SECURITY_OFFICER)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Journal de traçabilité (admin / responsable sécurité)' })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.findAll({
      page: query.page,
      limit: query.limit,
      action: query.action,
      userId: query.userId,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }
}

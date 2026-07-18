import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistiques')
@ApiBearerAuth('JWT-auth')
@Roles(Role.ADMIN, Role.SECURITY_OFFICER, Role.MANAGER)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Indicateurs globaux (un chef ne voit que son département)',
  })
  overview(@CurrentUser() user: AuthUser) {
    return this.statisticsService.overview(user);
  }

  @Get('by-department')
  @ApiOperation({ summary: 'Répartition des demandes par département' })
  byDepartment(@CurrentUser() user: AuthUser) {
    return this.statisticsService.byDepartment(user);
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Répartition des demandes par type de formulaire' })
  byType(@CurrentUser() user: AuthUser) {
    return this.statisticsService.byType(user);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Évolution mensuelle (créées / acceptées / refusées)' })
  @ApiQuery({ name: 'months', required: false, description: 'Nombre de mois (défaut 6, max 24)' })
  monthly(
    @CurrentUser() user: AuthUser,
    @Query('months', new ParseIntPipe({ optional: true })) months?: number,
  ) {
    const window = Math.min(Math.max(months ?? 6, 1), 24);
    return this.statisticsService.monthly(user, window);
  }
}

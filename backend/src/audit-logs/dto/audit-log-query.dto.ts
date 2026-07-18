import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditAction } from '../../common/enums';

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction, { message: 'Action invalide.' })
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Filtrer par utilisateur' })
  @IsOptional()
  @IsMongoId({ message: "Identifiant d'utilisateur invalide." })
  userId?: string;

  @ApiPropertyOptional({ description: 'À partir du (AAAA-MM-JJ)' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début invalide.' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Jusqu'au (AAAA-MM-JJ, inclus)" })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide.' })
  dateTo?: string;
}

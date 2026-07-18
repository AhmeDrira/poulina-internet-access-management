import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequestStatus, RequestType } from '../../common/enums';

export class RequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus, { message: 'Statut invalide.' })
  status?: RequestStatus;

  @ApiPropertyOptional({ enum: RequestType, description: 'Filtrer par type de formulaire' })
  @IsOptional()
  @IsEnum(RequestType, { message: 'Type de formulaire invalide.' })
  requestType?: RequestType;

  @ApiPropertyOptional({ description: 'Filtrer par département' })
  @IsOptional()
  @IsMongoId({ message: 'Identifiant de département invalide.' })
  department?: string;

  @ApiPropertyOptional({ description: 'Créées à partir du (AAAA-MM-JJ)' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début invalide.' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Créées jusqu'au (AAAA-MM-JJ, inclus)" })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide.' })
  dateTo?: string;
}

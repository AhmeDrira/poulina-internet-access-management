import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequestType, ThreadStatus } from '../../common/enums';

export class ThreadQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ThreadStatus })
  @IsOptional()
  @IsEnum(ThreadStatus, { message: 'Statut de fil invalide.' })
  status?: ThreadStatus;

  @ApiPropertyOptional({ enum: RequestType })
  @IsOptional()
  @IsEnum(RequestType, { message: 'Type de formulaire invalide.' })
  requestType?: RequestType;

  @ApiPropertyOptional({ description: 'Ne renvoyer que les fils comportant des messages non lus' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

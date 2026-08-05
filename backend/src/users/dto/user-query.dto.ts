import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums';

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'Rôle invalide.' })
  role?: Role;

  @ApiPropertyOptional({ description: 'Filtrer par département' })
  @IsOptional()
  @IsMongoId({ message: 'Identifiant de département invalide.' })
  department?: string;

  @ApiPropertyOptional({ description: 'true = actifs uniquement, false = inactifs uniquement' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'true = comptes en attente d’activation, false = comptes déjà activés',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  pendingActivation?: boolean;
}

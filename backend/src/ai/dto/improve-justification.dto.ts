import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessType, DurationType, RequestType } from '../../common/enums';

export class ImproveJustificationDto {
  @ApiProperty({ enum: RequestType, description: 'Formulaire concerné' })
  @IsEnum(RequestType, { message: 'Type de formulaire invalide.' })
  requestType: RequestType;

  @ApiProperty({ description: 'Brouillon saisi par l’employé', minLength: 15, maxLength: 2000 })
  @IsString()
  @MinLength(15, {
    message: 'Écrivez d’abord quelques mots sur votre besoin (15 caractères minimum).',
  })
  @MaxLength(2000, { message: 'La justification ne peut pas dépasser 2000 caractères.' })
  draft: string;

  @ApiPropertyOptional({ enum: AccessType })
  @IsOptional()
  @IsEnum(AccessType, { message: 'Type d’accès invalide.' })
  accessType?: AccessType;

  @ApiPropertyOptional({ enum: DurationType })
  @IsOptional()
  @IsEnum(DurationType, { message: 'Type de durée invalide.' })
  durationType?: DurationType;

  @ApiPropertyOptional({ description: 'Durée demandée en jours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(730)
  durationDays?: number;
}

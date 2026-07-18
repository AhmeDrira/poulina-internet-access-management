import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRequestDto {
  @ApiPropertyOptional({ description: 'Commentaire du chef de département (optionnel)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Le commentaire ne doit pas dépasser 1000 caractères.' })
  comment?: string;
}

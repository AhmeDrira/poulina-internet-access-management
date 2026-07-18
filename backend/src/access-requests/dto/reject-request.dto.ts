import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectRequestDto {
  @ApiProperty({ description: 'Motif du refus (obligatoire)' })
  @IsString()
  @MinLength(5, { message: 'Le motif de refus est obligatoire (5 caractères minimum).' })
  @MaxLength(1000, { message: 'Le motif ne doit pas dépasser 1000 caractères.' })
  reason: string;

  @ApiPropertyOptional({ description: 'Commentaire complémentaire (optionnel)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

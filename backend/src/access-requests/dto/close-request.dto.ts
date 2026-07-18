import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseRequestDto {
  @ApiPropertyOptional({ description: 'Commentaire de clôture (optionnel)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

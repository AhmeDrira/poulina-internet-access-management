import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Le chef demande une modification / des informations complémentaires */
export class RequestChangesDto {
  @ApiProperty({ description: 'Informations ou corrections attendues (obligatoire)' })
  @IsString()
  @MinLength(5, { message: 'Précisez les modifications attendues (5 caractères minimum).' })
  @MaxLength(1000, { message: 'Le commentaire ne doit pas dépasser 1000 caractères.' })
  comment: string;
}

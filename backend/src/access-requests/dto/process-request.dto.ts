import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcessRequestDto {
  @ApiProperty({ description: "true = accès activé, false = clôture sans activation" })
  @IsBoolean({ message: 'Le champ accessActivated doit être un booléen.' })
  accessActivated: boolean;

  @ApiPropertyOptional({ description: "Date d'activation (ISO, défaut : maintenant)" })
  @IsOptional()
  @IsDateString({}, { message: "Date d'activation invalide." })
  activationDate?: string;

  @ApiPropertyOptional({ description: "Date d'expiration (ISO)" })
  @IsOptional()
  @IsDateString({}, { message: "Date d'expiration invalide." })
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Commentaire technique (obligatoire si non activé)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Le commentaire ne doit pas dépasser 1000 caractères.' })
  networkComment?: string;
}

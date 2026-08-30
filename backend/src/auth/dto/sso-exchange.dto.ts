import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Code à usage unique remis au portail après authentification chez le fournisseur */
export class SsoExchangeDto {
  @ApiProperty({ description: 'Code d’échange à usage unique' })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Code de connexion invalide.' })
  code: string;
}

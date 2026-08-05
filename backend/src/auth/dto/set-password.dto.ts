import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/decorators/strong-password.decorator';

/**
 * Définition du mot de passe depuis un lien d'activation temporaire :
 * seule étape autorisée avant la première utilisation du compte.
 */
export class SetPasswordDto {
  @ApiProperty({
    description: 'Mot de passe choisi par l’employé (8 caractères minimum, lettres et chiffres)',
  })
  @IsStrongPassword()
  password: string;
}

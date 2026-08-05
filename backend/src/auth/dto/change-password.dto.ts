import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/decorators/strong-password.decorator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (8 caractères minimum, au moins une lettre et un chiffre)',
  })
  @IsStrongPassword()
  newPassword: string;
}

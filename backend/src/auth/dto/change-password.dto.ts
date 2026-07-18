import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword: string;

  @ApiProperty({ description: 'Nouveau mot de passe (8 caractères minimum)' })
  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
  newPassword: string;
}

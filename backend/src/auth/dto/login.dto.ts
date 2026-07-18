import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'employee@poulina.tn' })
  @IsEmail({}, { message: "L'adresse email est invalide." })
  email: string;

  @ApiProperty({ example: 'Employee@2026' })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe est obligatoire.' })
  password: string;
}

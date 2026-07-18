import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums';

export class CreateUserDto {
  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  firstName: string;

  @ApiProperty({ example: 'Drira' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  lastName: string;

  @ApiProperty({ example: 'PGH-0042', description: 'Matricule interne unique' })
  @IsString()
  @IsNotEmpty({ message: 'Le matricule est obligatoire.' })
  matricule: string;

  @ApiProperty({ example: 'ahmed.drira@poulina.tn' })
  @IsEmail({}, { message: "L'adresse email est invalide." })
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password: string;

  @ApiProperty({ enum: Role, example: Role.EMPLOYEE })
  @IsEnum(Role, { message: 'Rôle invalide.' })
  role: Role;

  @ApiPropertyOptional({ description: 'Identifiant du département' })
  @IsOptional()
  @IsMongoId({ message: 'Identifiant de département invalide.' })
  department?: string;

  @ApiPropertyOptional({ description: 'Identifiant du service' })
  @IsOptional()
  @IsMongoId({ message: 'Identifiant de service invalide.' })
  service?: string;

  @ApiPropertyOptional({ example: 'Développeur' })
  @IsOptional()
  @IsString()
  position?: string;
}

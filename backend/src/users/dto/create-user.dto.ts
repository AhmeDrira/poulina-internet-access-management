import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums';

/**
 * Création d'un compte par une personne habilitée.
 * Aucun mot de passe n'est saisi ici : l'application génère un lien
 * d'activation temporaire que l'employé utilise pour définir le sien.
 */
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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Nom du département', example: 'Informatique' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le nom du département est obligatoire.' })
  name: string;

  @ApiProperty({ description: 'Code court du département (8 caractères max)', example: 'IT' })
  @IsString({ message: 'Le code doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le code du département est obligatoire.' })
  @MaxLength(8, { message: 'Le code ne doit pas dépasser 8 caractères.' })
  code: string;

  @ApiPropertyOptional({ description: 'Description du département' })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères.' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Identifiant du chef de département (utilisateur avec le rôle MANAGER ou ADMIN)',
  })
  @IsOptional()
  @IsMongoId({ message: "L'identifiant du chef de département est invalide." })
  manager?: string;
}

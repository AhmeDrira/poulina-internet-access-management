import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Réseau et Serveurs' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du service est obligatoire.' })
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Identifiant du département de rattachement' })
  @IsMongoId({ message: 'Identifiant de département invalide.' })
  department: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FormFieldKind } from '../../common/enums';

export class FormFieldOptionDto {
  @ApiProperty({ example: 'VPN', description: 'Valeur technique stockée' })
  @IsString()
  @IsNotEmpty({ message: 'La valeur d’une option est obligatoire.' })
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message:
      'La valeur d’une option ne peut contenir que des lettres, chiffres, tirets et underscores.',
  })
  value: string;

  @ApiProperty({ example: 'VPN du groupe', description: 'Libellé affiché' })
  @IsString()
  @IsNotEmpty({ message: 'Le libellé d’une option est obligatoire.' })
  @MaxLength(160)
  label: string;
}

export class FormFieldDto {
  @ApiProperty({ example: 'connectionMethod' })
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, {
    message:
      'La clé technique doit commencer par une lettre et ne contenir que lettres, chiffres et underscores (40 caractères maximum).',
  })
  key: string;

  @ApiProperty({ example: 'Méthode de connexion' })
  @IsString()
  @IsNotEmpty({ message: 'Le libellé du champ est obligatoire.' })
  @MaxLength(400)
  label: string;

  @ApiProperty({ enum: FormFieldKind })
  @IsEnum(FormFieldKind, { message: 'Type de champ invalide.' })
  kind: FormFieldKind;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Longueur maximale (champs texte)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  maxLength?: number;

  @ApiPropertyOptional({ description: 'Valeur minimale (champ numérique)' })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional({ description: 'Valeur maximale (champ numérique)' })
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Aide affichée sous le champ' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  helpText?: string;

  @ApiPropertyOptional({ type: [FormFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40, { message: 'Un champ ne peut pas dépasser 40 options.' })
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];
}

export class UpdateFormDefinitionDto {
  @ApiPropertyOptional({ example: "Demande d'accès Internet" })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le titre du formulaire ne peut pas être vide.' })
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ description: 'Libellé court (badges et tableaux)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shortLabel?: string;

  @ApiPropertyOptional({ description: 'Présentation affichée à l’employé' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @ApiPropertyOptional({ description: 'Consignes affichées en tête du formulaire' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiPropertyOptional({ description: "Demander le type d'accès Internet (complet / standard / restreint)" })
  @IsOptional()
  @IsBoolean()
  requiresAccessType?: boolean;

  @ApiPropertyOptional({ description: 'Le formulaire porte-t-il une durée ?' })
  @IsOptional()
  @IsBoolean()
  requiresDuration?: boolean;

  @ApiPropertyOptional({ description: 'Demander une justification libre ?' })
  @IsOptional()
  @IsBoolean()
  requiresJustification?: boolean;

  @ApiPropertyOptional({
    description: 'Justification enregistrée d’office si le formulaire n’en demande pas',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultJustification?: string;

  @ApiPropertyOptional({ type: [FormFieldDto], description: 'Champs, dans l’ordre d’affichage' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Un formulaire ne peut pas dépasser 30 champs spécifiques.' })
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];
}

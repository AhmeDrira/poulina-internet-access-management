import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AccessType, DurationType, RequestKind, RequestType } from '../../common/enums';

export class CreateAccessRequestDto {
  @ApiProperty({ enum: RequestType, example: RequestType.INTERNET_ACCESS })
  @IsEnum(RequestType, { message: 'Type de formulaire invalide.' })
  requestType: RequestType;

  @ApiProperty({ enum: RequestKind, example: RequestKind.NEW })
  @IsEnum(RequestKind, { message: 'Nature de demande invalide.' })
  requestKind: RequestKind;

  @ApiPropertyOptional({
    enum: AccessType,
    description: "Type d'accès Internet (obligatoire pour les demandes INTERNET_ACCESS)",
  })
  @IsOptional()
  @IsEnum(AccessType, { message: "Type d'accès invalide." })
  accessType?: AccessType;

  @ApiProperty({ enum: DurationType, example: DurationType.TEMPORARY })
  @IsEnum(DurationType, { message: 'Type de durée invalide.' })
  durationType: DurationType;

  @ApiPropertyOptional({ description: 'Durée en jours (obligatoire si durée temporaire)', example: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La durée doit être un nombre de jours entier.' })
  @Min(1, { message: 'La durée minimale est de 1 jour.' })
  @Max(730, { message: 'La durée maximale est de 730 jours (2 ans).' })
  durationDays?: number;

  @ApiPropertyOptional({
    description:
      'Justification du besoin (10 caractères minimum — facultative pour la fiche d’engagement du mot de passe)',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'La justification doit contenir au moins 10 caractères.' })
  @MaxLength(2000, { message: 'La justification ne doit pas dépasser 2000 caractères.' })
  justification?: string;

  @ApiPropertyOptional({
    description: 'Champs spécifiques au type de formulaire (validés côté serveur)',
    example: { connectionMethod: 'VPN', targetResource: 'srv-erp-01' },
  })
  @IsOptional()
  @IsObject({ message: 'Les champs du formulaire doivent être un objet.' })
  formData?: Record<string, unknown>;

  @ApiProperty({
    description: 'Confirmation obligatoire de la mention Lu et approuvé.',
    example: true,
  })
  @IsBoolean({ message: 'La confirmation Lu et approuvé est obligatoire.' })
  acknowledgementAccepted: boolean;

  @ApiPropertyOptional({
    description: 'Signature numérique du demandeur au format data URL PNG.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300000, { message: 'La signature numérique est trop volumineuse.' })
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, {
    message: 'La signature numérique doit être une image PNG valide.',
  })
  applicantSignature?: string;

  @ApiPropertyOptional({ description: 'Poste occupé (pré-rempli depuis le profil)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @ApiPropertyOptional({ description: 'Service de rattachement (doit appartenir au département)' })
  @IsOptional()
  @IsMongoId({ message: 'Identifiant de service invalide.' })
  serviceId?: string;
}

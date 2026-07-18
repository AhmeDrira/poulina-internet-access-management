import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateAccessRequestDto } from './create-access-request.dto';

/**
 * Modification d'une demande par son auteur, uniquement lorsque le chef
 * a demandé des modifications (statut CHANGES_REQUESTED).
 * Le type de formulaire ne peut pas changer : il faut créer une autre demande.
 */
export class UpdateAccessRequestDto extends PartialType(
  OmitType(CreateAccessRequestDto, ['requestType'] as const),
) {
  @ApiPropertyOptional({ description: "Message de l'employé accompagnant la re-soumission" })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Le message ne doit pas dépasser 1000 caractères.' })
  resubmitComment?: string;
}

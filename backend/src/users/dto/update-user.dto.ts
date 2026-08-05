import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Tous les champs de création, optionnels.
 * Le mot de passe ne fait volontairement pas partie des champs modifiables :
 * un administrateur ne définit jamais le mot de passe d'un employé, il génère
 * un lien d'activation (POST /users/:id/activation-link).
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

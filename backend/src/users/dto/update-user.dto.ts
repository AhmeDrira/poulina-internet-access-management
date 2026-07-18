import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/** Tous les champs de création, optionnels (mot de passe inclus : re-haché si fourni) */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

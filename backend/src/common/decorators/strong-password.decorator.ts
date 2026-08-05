import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Longueur minimale d'un mot de passe (politique interne) */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Politique de mot de passe appliquée partout où un mot de passe est défini
 * (activation d'un compte, changement volontaire ou imposé) :
 * 8 caractères minimum, au moins une lettre et un chiffre.
 */
export function IsStrongPassword(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    IsString({ message: 'Le mot de passe est invalide.' })(target, propertyKey);
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
    })(target, propertyKey);
    MaxLength(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères.' })(
      target,
      propertyKey,
    );
    Matches(/[A-Za-z]/, { message: 'Le mot de passe doit contenir au moins une lettre.' })(
      target,
      propertyKey,
    );
    Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })(
      target,
      propertyKey,
    );
  };
}

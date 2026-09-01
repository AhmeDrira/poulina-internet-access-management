import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  /** Matricule interne unique de l'employé */
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  matricule: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /**
   * Mot de passe haché (bcrypt) — jamais renvoyé par défaut.
   * `null` tant que l'employé n'a pas défini son mot de passe via
   * le lien d'activation : la connexion est alors impossible.
   */
  @Prop({ type: String, required: false, select: false, default: null })
  password: string | null;

  @Prop({ type: String, enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null })
  department: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Service', default: null })
  service: Types.ObjectId | null;

  /**
   * Responsable direct (hiérarchie de l'annuaire RH).
   * C'est lui qui examine les demandes de cet employé : le rattachement
   * hiérarchique prime sur le département, car un responsable peut encadrer
   * plusieurs unités et une unité compter plusieurs responsables.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  manager: Types.ObjectId | null;

  /**
   * Adresse générée automatiquement à l'import faute d'email dans l'annuaire
   * source. Ces comptes doivent recevoir leur vraie adresse professionnelle
   * (et ne peuvent pas utiliser l'authentification unique en attendant).
   */
  @Prop({ default: false })
  emailIsTemporary: boolean;

  /** Poste occupé (ex : Développeur, Comptable...) */
  @Prop({ trim: true, default: '' })
  position: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // ---------- Cycle de vie du compte (création par une personne habilitée) ----------

  /**
   * Empreinte SHA-256 du lien d'activation en cours (le lien en clair n'est
   * jamais stocké). Effacée dès la première utilisation : usage unique.
   */
  @Prop({ type: String, select: false, default: null })
  activationTokenHash: string | null;

  /** Échéance du lien d'activation */
  @Prop({ type: Date, default: null })
  activationExpiresAt: Date | null;

  /** Date d'envoi du dernier lien d'activation */
  @Prop({ type: Date, default: null })
  activationSentAt: Date | null;

  /** Date à laquelle l'employé a défini son mot de passe (compte utilisable) */
  @Prop({ type: Date, default: null })
  activatedAt: Date | null;

  /**
   * Identifiant du compte chez le fournisseur d'identité (claim `sub`),
   * renseigné à la première connexion par authentification unique.
   */
  @Prop({ type: String, default: null })
  ssoSubject: string | null;

  /** Personne habilitée ayant créé le compte */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  invitedBy: Types.ObjectId | null;

  /**
   * Changement de mot de passe imposé : l'application reste bloquée
   * (hors profil et changement de mot de passe) tant qu'il n'est pas fait.
   */
  @Prop({ default: false })
  mustChangePassword: boolean;

  // Renseignés automatiquement par { timestamps: true }
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

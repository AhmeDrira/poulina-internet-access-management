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

  /** Mot de passe haché (bcrypt) — jamais renvoyé par défaut */
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null })
  department: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Service', default: null })
  service: Types.ObjectId | null;

  /** Poste occupé (ex : Développeur, Comptable...) */
  @Prop({ trim: true, default: '' })
  position: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // Renseignés automatiquement par { timestamps: true }
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

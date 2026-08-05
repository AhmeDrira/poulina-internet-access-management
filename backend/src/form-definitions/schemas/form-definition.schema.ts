import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FormFieldKind, RequestType } from '../../common/enums';

export type FormDefinitionDocument = HydratedDocument<FormDefinition>;

/** Valeur autorisée d'un champ de type liste */
@Schema({ _id: false })
export class FormFieldOption {
  @Prop({ required: true, trim: true })
  value: string;

  @Prop({ required: true, trim: true })
  label: string;
}

export const FormFieldOptionSchema = SchemaFactory.createForClass(FormFieldOption);

/** Champ spécifique d'un formulaire (l'ordre du tableau est l'ordre d'affichage) */
@Schema({ _id: false })
export class FormFieldDefinition {
  /** Clé technique stockée dans `formData` (immuable dans les demandes existantes) */
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ type: String, enum: FormFieldKind, required: true })
  kind: FormFieldKind;

  @Prop({ default: false })
  required: boolean;

  /** Longueur maximale (champs texte) */
  @Prop({ type: Number, default: null })
  maxLength: number | null;

  /** Bornes (champs numériques) */
  @Prop({ type: Number, default: null })
  min: number | null;

  @Prop({ type: Number, default: null })
  max: number | null;

  @Prop({ trim: true, default: '' })
  placeholder: string;

  @Prop({ trim: true, default: '' })
  helpText: string;

  @Prop({ type: [FormFieldOptionSchema], default: [] })
  options: FormFieldOption[];
}

export const FormFieldDefinitionSchema = SchemaFactory.createForClass(FormFieldDefinition);

/**
 * Formulaire numérisé, modifiable par le super administrateur.
 * Une définition par type de demande (les 6 anciens formulaires papier).
 */
@Schema({ timestamps: true })
export class FormDefinition {
  @Prop({ type: String, enum: RequestType, required: true, unique: true })
  requestType: RequestType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  shortLabel: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ trim: true, default: '' })
  instructions: string;

  /** Un formulaire désactivé n'est plus proposé aux employés (demandes existantes conservées) */
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  requiresAccessType: boolean;

  @Prop({ default: true })
  requiresDuration: boolean;

  @Prop({ default: true })
  requiresJustification: boolean;

  /** Justification enregistrée d'office quand le formulaire n'en demande pas */
  @Prop({ trim: true, default: '' })
  defaultJustification: string;

  @Prop({ type: [FormFieldDefinitionSchema], default: [] })
  fields: FormFieldDefinition[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy: Types.ObjectId | null;

  /** Incrémentée à chaque modification : trace les évolutions du formulaire */
  @Prop({ default: 1 })
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

export const FormDefinitionSchema = SchemaFactory.createForClass(FormDefinition);

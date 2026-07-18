import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  /** Code court du département (ex : IT, FIN, MKT) */
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code: string;

  @Prop({ trim: true, default: '' })
  description: string;

  /** Chef de département responsable de la validation des demandes */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  manager: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

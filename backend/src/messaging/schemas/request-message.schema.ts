import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums';

export type RequestMessageDocument = HydratedDocument<RequestMessage>;

/** Message professionnel échangé dans un fil rattaché à une demande */
@Schema({ timestamps: true })
export class RequestMessage {
  @Prop({ type: Types.ObjectId, ref: 'RequestThread', required: true, index: true })
  thread: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AccessRequest', required: true, index: true })
  request: Types.ObjectId;

  /** Département de la demande (repli d'accès) */
  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
  department: Types.ObjectId;

  /** Responsable de la demande : borne le comptage des non-lus du chef */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  approver: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  /** Rôle de l'auteur au moment de l'envoi (chef de département ou équipe réseau) */
  @Prop({ type: String, enum: Role, required: true })
  authorRole: Role;

  @Prop({ required: true, trim: true })
  body: string;

  /** Destinataires ayant consulté le message */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  readBy: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

export const RequestMessageSchema = SchemaFactory.createForClass(RequestMessage);

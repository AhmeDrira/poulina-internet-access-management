import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RequestType, ThreadStatus } from '../../common/enums';

export type RequestThreadDocument = HydratedDocument<RequestThread>;

/**
 * Fil de discussion interne rattaché à une demande, strictement réservé au
 * chef du département concerné et à l'équipe réseau (voir MessagingService).
 * Un seul fil par demande : les échanges restent liés au traitement.
 */
@Schema({ timestamps: true })
export class RequestThread {
  @Prop({ type: Types.ObjectId, ref: 'AccessRequest', required: true, unique: true })
  request: Types.ObjectId;

  /** Référence de la demande, dupliquée pour la recherche et l'affichage */
  @Prop({ required: true, trim: true })
  reference: string;

  @Prop({ type: String, enum: RequestType, required: true })
  requestType: RequestType;

  /** Département de la demande : borne l'accès du chef de département */
  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
  department: Types.ObjectId;

  /** Nom du demandeur, dupliqué pour l'affichage de la liste des fils */
  @Prop({ required: true, trim: true })
  requesterName: string;

  @Prop({ type: String, enum: ThreadStatus, default: ThreadStatus.OPEN, index: true })
  status: ThreadStatus;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  /** Début du dernier message (aperçu dans la liste) */
  @Prop({ trim: true, default: '' })
  lastMessagePreview: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  lastMessageBy: Types.ObjectId | null;

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  resolvedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const RequestThreadSchema = SchemaFactory.createForClass(RequestThread);

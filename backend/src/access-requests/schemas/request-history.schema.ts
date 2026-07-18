import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RequestStatus } from '../../common/enums';

export type RequestHistoryDocument = HydratedDocument<RequestHistory>;

/** Entrée de la timeline d'une demande (historisation de chaque action) */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RequestHistory {
  @Prop({ type: Types.ObjectId, ref: 'AccessRequest', required: true, index: true })
  request: Types.ObjectId;

  /** Libellé de l'action (ex : "Demande créée", "Acceptée par le chef") */
  @Prop({ required: true })
  action: string;

  @Prop({ type: String, enum: RequestStatus, default: null })
  fromStatus: RequestStatus | null;

  @Prop({ type: String, enum: RequestStatus, required: true })
  toStatus: RequestStatus;

  /** Utilisateur à l'origine de l'action (null pour les actions système) */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  performedBy: Types.ObjectId | null;

  @Prop({ default: '' })
  comment: string;

  createdAt: Date;
}

export const RequestHistorySchema = SchemaFactory.createForClass(RequestHistory);

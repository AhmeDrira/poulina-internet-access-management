import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditAction } from '../../common/enums';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/** Journal de sécurité et de traçabilité (qui a fait quoi, quand, d'où) */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  /** Utilisateur à l'origine de l'action (null si tentative de connexion échouée) */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  user: Types.ObjectId | null;

  /** Email conservé même si l'utilisateur est supprimé */
  @Prop({ default: '' })
  userEmail: string;

  @Prop({ type: String, enum: AuditAction, required: true, index: true })
  action: AuditAction;

  @Prop({ default: '' })
  ipAddress: string;

  @Prop({ default: '' })
  userAgent: string;

  /** Détails contextuels de l'action (référence demande, champs modifiés...) */
  @Prop({ type: Object, default: {} })
  details: Record<string, any>;

  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

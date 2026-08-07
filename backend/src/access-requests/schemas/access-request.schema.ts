import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AccessType,
  DurationType,
  RecommendationLevel,
  RequestKind,
  RequestStatus,
  RequestType,
} from '../../common/enums';

/** Résultat du module d'aide à la décision (calculé à la création) */
@Schema({ _id: false })
export class DecisionSupport {
  /** Score de 0 à 100 (plus il est élevé, plus la demande semble légitime) */
  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop({ type: String, enum: RecommendationLevel, required: true })
  level: RecommendationLevel;

  /** Règles déclenchées, affichées au chef de département */
  @Prop({ type: [String], default: [] })
  reasons: string[];
}

export const DecisionSupportSchema = SchemaFactory.createForClass(DecisionSupport);

export type AccessRequestDocument = HydratedDocument<AccessRequest>;

@Schema({ timestamps: true })
export class AccessRequest {
  /** Référence lisible unique, préfixée par type (ex : REQ-NET-2026-0042) */
  @Prop({ required: true, unique: true })
  reference: string;

  /** Type de formulaire (Internet, accès distant, lecteur externe...) */
  @Prop({
    type: String,
    enum: RequestType,
    required: true,
    default: RequestType.INTERNET_ACCESS,
    index: true,
  })
  requestType: RequestType;

  /** Nouvelle demande ou renouvellement */
  @Prop({ type: String, enum: RequestKind, required: true, default: RequestKind.NEW })
  requestKind: RequestKind;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  requester: Types.ObjectId;

  // --- Instantané des informations du demandeur au moment de la demande ---
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  matricule: string;

  @Prop({ required: true })
  email: string;

  @Prop({ default: '' })
  position: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
  department: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', default: null })
  service: Types.ObjectId | null;

  // --- Contenu de la demande ---
  /** Type d'accès Internet (uniquement pour les demandes INTERNET_ACCESS) */
  @Prop({ type: String, enum: AccessType, default: null })
  accessType: AccessType | null;

  /** Champs spécifiques au type de formulaire (validés par form-definitions.ts) */
  @Prop({ type: Object, default: {} })
  formData: Record<string, unknown>;

  @Prop({ type: String, enum: DurationType, required: true })
  durationType: DurationType;

  /** Durée en jours (obligatoire si durationType = TEMPORARY) */
  @Prop({ type: Number, default: null, min: 1 })
  durationDays: number | null;

  @Prop({ required: true, trim: true })
  justification: string;

  /** Acceptation explicite de la mention "Lu et approuve" */
  @Prop({ default: false })
  acknowledgementAccepted: boolean;

  @Prop({ type: Date, default: null })
  acknowledgedAt: Date | null;

  /** Signature numerique du demandeur au format data URL PNG, si fournie */
  @Prop({ default: '' })
  applicantSignature: string;

  @Prop({ type: Date, default: null })
  applicantSignedAt: Date | null;

  @Prop({
    type: String,
    enum: RequestStatus,
    default: RequestStatus.PENDING_MANAGER,
    index: true,
  })
  status: RequestStatus;

  // --- Décision du chef de département ---
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  managerDecisionBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  managerDecisionAt: Date | null;

  @Prop({ default: '' })
  managerComment: string;

  /** Motif de refus (obligatoire en cas de refus) */
  @Prop({ default: '' })
  rejectionReason: string;

  // --- Traitement par l'équipe réseau et serveur ---
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  processedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  processedAt: Date | null;

  @Prop({ default: '' })
  networkComment: string;

  /** Accès effectivement activé ou non par l'équipe réseau */
  @Prop({ type: Boolean, default: null })
  accessActivated: boolean | null;

  @Prop({ type: Date, default: null })
  activationDate: Date | null;

  @Prop({ type: Date, default: null })
  expirationDate: Date | null;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  /** Évite d'envoyer plusieurs rappels d'expiration imminente */
  @Prop({ default: false })
  expiryReminderSent: boolean;

  // --- Aide à la décision ---
  @Prop({ type: DecisionSupportSchema, required: true })
  decisionSupport: DecisionSupport;

  createdAt: Date;
  updatedAt: Date;
}

export const AccessRequestSchema = SchemaFactory.createForClass(AccessRequest);

/**
 * Script de peuplement de la base de démonstration.
 * Usage : npm run seed   (ATTENTION : vide les collections existantes)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { UserSchema } from '../users/schemas/user.schema';
import { DepartmentSchema } from '../departments/schemas/department.schema';
import { ServiceSchema } from '../services/schemas/service.schema';
import { AccessRequestSchema } from '../access-requests/schemas/access-request.schema';
import { RequestHistorySchema } from '../access-requests/schemas/request-history.schema';
import { NotificationSchema } from '../notifications/schemas/notification.schema';
import { AuditLogSchema } from '../audit-logs/schemas/audit-log.schema';
import { FormDefinitionSchema } from '../form-definitions/schemas/form-definition.schema';
import { DEFAULT_FORM_DEFINITIONS } from '../form-definitions/form-definitions.defaults';
import { RequestThreadSchema } from '../messaging/schemas/request-thread.schema';
import { RequestMessageSchema } from '../messaging/schemas/request-message.schema';
import { DecisionHelperService } from '../decision-helper/decision-helper.service';
import {
  AccessType,
  AuditAction,
  DurationType,
  NotificationType,
  RequestStatus,
  RequestType,
  Role,
  ThreadStatus,
} from '../common/enums';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/poulina_internet_access';

const UserModel = mongoose.model('User', UserSchema);
const DepartmentModel = mongoose.model('Department', DepartmentSchema);
const ServiceModel = mongoose.model('Service', ServiceSchema);
const AccessRequestModel = mongoose.model('AccessRequest', AccessRequestSchema);
const RequestHistoryModel = mongoose.model('RequestHistory', RequestHistorySchema);
const NotificationModel = mongoose.model('Notification', NotificationSchema);
const AuditLogModel = mongoose.model('AuditLog', AuditLogSchema);
const FormDefinitionModel = mongoose.model('FormDefinition', FormDefinitionSchema);
const RequestThreadModel = mongoose.model('RequestThread', RequestThreadSchema);
const RequestMessageModel = mongoose.model('RequestMessage', RequestMessageSchema);

const decisionHelper = new DecisionHelperService();
const hash = (password: string) => bcrypt.hashSync(password, 10);
const daysAgo = (days: number, hours = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hours, 0, 0, 0);
  return date;
};
const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
};

/**
 * Force createdAt/updatedAt en passant par le driver natif :
 * Mongoose déclare createdAt immuable et ignorerait la mise à jour.
 */
async function backdate(model: mongoose.Model<any>, id: mongoose.Types.ObjectId, date: Date) {
  await model.collection.updateOne({ _id: id }, { $set: { createdAt: date, updatedAt: date } });
}

async function seed() {
  console.log(`Connexion à ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);

  console.log('Nettoyage des collections...');
  await Promise.all([
    UserModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    ServiceModel.deleteMany({}),
    AccessRequestModel.deleteMany({}),
    RequestHistoryModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
    FormDefinitionModel.deleteMany({}),
    RequestThreadModel.deleteMany({}),
    RequestMessageModel.deleteMany({}),
  ]);

  // ------------------------------------------------------------------
  // Formulaires (définitions modifiables par le super administrateur)
  // ------------------------------------------------------------------
  console.log('Création des définitions de formulaires...');
  await FormDefinitionModel.create(
    Object.values(DEFAULT_FORM_DEFINITIONS).map((definition) => ({
      ...definition,
      isActive: true,
      version: 1,
      updatedBy: null,
    })),
  );

  // ------------------------------------------------------------------
  // Départements et services
  // ------------------------------------------------------------------
  console.log('Création des départements et services...');
  const [it, fin, mkt, rh, prod] = await DepartmentModel.create([
    { name: 'Informatique', code: 'IT', description: 'Systèmes d’information, développement et infrastructure du groupe.' },
    { name: 'Finance et Contrôle de Gestion', code: 'FIN', description: 'Comptabilité, trésorerie, contrôle de gestion — données chiffrées sensibles.' },
    { name: 'Marketing', code: 'MKT', description: 'Communication, marques et présence digitale.' },
    { name: 'Ressources Humaines', code: 'RH', description: 'Recrutement, formation et gestion du personnel.' },
    { name: 'Production', code: 'PROD', description: 'Sites de production et logistique.' },
  ]);

  const [srvReseau, srvDev, srvSupport, srvCompta, , srvCom, srvRecrut, srvLogistique] =
    await ServiceModel.create([
      { name: 'Réseau et Serveurs', department: it._id, description: 'Infrastructure réseau, serveurs et sécurité.' },
      { name: 'Développement', department: it._id, description: 'Applications métier internes.' },
      { name: 'Support', department: it._id, description: 'Assistance aux utilisateurs.' },
      { name: 'Comptabilité', department: fin._id, description: 'Comptabilité générale et fournisseurs.' },
      { name: 'Trésorerie', department: fin._id, description: 'Gestion des flux financiers.' },
      { name: 'Communication Digitale', department: mkt._id, description: 'Réseaux sociaux et site du groupe.' },
      { name: 'Recrutement et Formation', department: rh._id, description: 'Acquisition et développement des talents.' },
      { name: 'Logistique', department: prod._id, description: 'Approvisionnement et expédition.' },
    ]);

  // ------------------------------------------------------------------
  // Utilisateurs
  // ------------------------------------------------------------------
  console.log('Création des utilisateurs...');
  // activatedAt renseigné : ces comptes de démonstration ont déjà défini leur mot de passe
  const activated = daysAgo(60);
  const [superAdmin, admin, managerIt, managerMkt, ahmed, malek, yassine, rania, nabil, leila] =
    await UserModel.create([
      {
        firstName: 'Mourad', lastName: 'Jeribi', matricule: 'PGH-0000',
        email: 'superadmin@poulina.tn', password: hash('Super@2026'), role: Role.SUPER_ADMIN,
        department: it._id, service: null, position: 'Responsable du système d’information',
        activatedAt: activated,
      },
      {
        firstName: 'Sami', lastName: 'Bouazizi', matricule: 'PGH-0001',
        email: 'admin@poulina.tn', password: hash('Admin@2026'), role: Role.ADMIN,
        department: it._id, service: srvSupport._id, position: 'Administrateur systèmes',
        activatedAt: activated,
      },
      {
        firstName: 'Karim', lastName: 'Ben Salah', matricule: 'PGH-0002',
        email: 'manager.it@poulina.tn', password: hash('Manager@2026'), role: Role.MANAGER,
        department: it._id, service: null, position: 'Chef du département informatique',
        activatedAt: activated,
      },
      {
        firstName: 'Sonia', lastName: 'Trabelsi', matricule: 'PGH-0003',
        email: 'manager.mkt@poulina.tn', password: hash('Manager@2026'), role: Role.MANAGER,
        department: mkt._id, service: null, position: 'Chef du département marketing',
        activatedAt: activated,
      },
      {
        firstName: 'Ahmed Amine', lastName: 'Drira', matricule: 'PGH-0010',
        email: 'employee@poulina.tn', password: hash('Employee@2026'), role: Role.EMPLOYEE,
        department: it._id, service: srvDev._id, position: 'Développeur stagiaire',
        activatedAt: activated,
      },
      {
        firstName: 'Malek', lastName: 'Rahmouni', matricule: 'PGH-0011',
        email: 'malek.rahmouni@poulina.tn', password: hash('Employee@2026'), role: Role.EMPLOYEE,
        department: mkt._id, service: srvCom._id, position: 'Chargé de communication',
        activatedAt: activated,
      },
      {
        firstName: 'Yassine', lastName: 'Jlassi', matricule: 'PGH-0012',
        email: 'yassine.jlassi@poulina.tn', password: hash('Employee@2026'), role: Role.EMPLOYEE,
        department: fin._id, service: srvCompta._id, position: 'Comptable',
        activatedAt: activated,
      },
      {
        firstName: 'Rania', lastName: 'Khelifi', matricule: 'PGH-0013',
        email: 'rania.khelifi@poulina.tn', password: hash('Employee@2026'), role: Role.EMPLOYEE,
        department: rh._id, service: srvRecrut._id, position: 'Chargée de recrutement',
        activatedAt: activated,
      },
      {
        firstName: 'Nabil', lastName: 'Gharbi', matricule: 'PGH-0020',
        email: 'network@poulina.tn', password: hash('Network@2026'), role: Role.NETWORK_TEAM,
        department: it._id, service: srvReseau._id, position: 'Ingénieur réseau',
        activatedAt: activated,
      },
      {
        firstName: 'Leila', lastName: 'Mansour', matricule: 'PGH-0030',
        email: 'security@poulina.tn', password: hash('Security@2026'), role: Role.SECURITY_OFFICER,
        department: it._id, service: null, position: 'Responsable sécurité SI',
        activatedAt: activated,
      },
    ]);

  // Compte créé par l'administrateur mais jamais activé : illustre le scénario
  // d'arrivée d'un nouvel employé (lien d'activation en attente d'utilisation).
  const pendingEmployee = await UserModel.create({
    firstName: 'Nour', lastName: 'Belhadj', matricule: 'PGH-0014',
    email: 'nour.belhadj@poulina.tn', password: null, role: Role.EMPLOYEE,
    department: prod._id, service: srvLogistique._id, position: 'Assistante logistique',
    activatedAt: null,
    invitedBy: admin._id,
    activationSentAt: daysAgo(1),
    // Aucun hash de lien : l'administrateur doit en générer un nouveau depuis l'interface
    activationTokenHash: null,
    activationExpiresAt: null,
  });
  await backdate(UserModel, pendingEmployee._id, daysAgo(1));

  it.manager = managerIt._id;
  await it.save();
  mkt.manager = managerMkt._id;
  await mkt.save();
  void leila;

  // ------------------------------------------------------------------
  // Demandes (6 types de formulaires)
  // ------------------------------------------------------------------
  console.log('Création des demandes...');

  const makeBase = (spec: {
    reference: string;
    requestType: RequestType;
    requester: any;
    department: any;
    service: any;
    accessType?: AccessType | null;
    durationType: DurationType;
    durationDays: number | null;
    justification: string;
    formData?: Record<string, unknown>;
  }) => ({
    reference: spec.reference,
    requestType: spec.requestType,
    requester: spec.requester._id,
    firstName: spec.requester.firstName,
    lastName: spec.requester.lastName,
    matricule: spec.requester.matricule,
    email: spec.requester.email,
    position: spec.requester.position,
    department: spec.department._id,
    service: spec.service ? spec.service._id : null,
    accessType: spec.accessType ?? null,
    durationType: spec.durationType,
    durationDays: spec.durationDays,
    justification: spec.justification,
    formData: spec.formData ?? {},
    decisionSupport: decisionHelper.evaluate({
      requestType: spec.requestType,
      justification: spec.justification,
      accessType: spec.accessType ?? null,
      durationType: spec.durationType,
      durationDays: spec.durationDays,
      departmentName: spec.department.name,
      formData: spec.formData ?? {},
      previousRejectedCount: 0,
    }),
  });

  const addHistory = async (
    request: any,
    entries: {
      action: string;
      fromStatus: RequestStatus | null;
      toStatus: RequestStatus;
      performedBy: any;
      comment?: string;
      date: Date;
    }[],
  ) => {
    for (const entry of entries) {
      const history = await RequestHistoryModel.create({
        request: request._id,
        action: entry.action,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        performedBy: entry.performedBy ? entry.performedBy._id : null,
        comment: entry.comment ?? '',
      });
      await backdate(RequestHistoryModel, history._id, entry.date);
    }
  };

  // ---------- Accès Internet (workflow historique) ----------

  // R1 — Ahmed, bien justifiée, en attente du chef IT
  const r1 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0001', requestType: RequestType.INTERNET_ACCESS,
      requester: ahmed, department: it, service: srvDev,
      accessType: AccessType.STANDARD, durationType: DurationType.TEMPORARY, durationDays: 90,
      justification:
        "Dans le cadre du développement de l'application interne de gestion des stocks, j'ai besoin d'accéder à la documentation technique en ligne (MongoDB, NestJS, React), aux registres de paquets npm et aux forums techniques pour résoudre les problèmes rencontrés pendant le stage.",
    }),
    status: RequestStatus.PENDING_MANAGER,
  });
  await backdate(AccessRequestModel, r1._id, daysAgo(2));
  await addHistory(r1, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: ahmed, date: daysAgo(2) },
  ]);

  // R2 — Ahmed, accès complet permanent mal justifié : score risqué (démo du scoring)
  const r2 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0002', requestType: RequestType.INTERNET_ACCESS,
      requester: ahmed, department: it, service: srvDev,
      accessType: AccessType.FULL, durationType: DurationType.PERMANENT, durationDays: null,
      justification: 'Besoin internet complet.',
    }),
    status: RequestStatus.PENDING_MANAGER,
  });
  await backdate(AccessRequestModel, r2._id, daysAgo(1, 14));
  await addHistory(r2, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: ahmed, date: daysAgo(1, 14) },
  ]);

  // R3 — Malek, en attente du chef Marketing
  const r3 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0003', requestType: RequestType.INTERNET_ACCESS,
      requester: malek, department: mkt, service: srvCom,
      accessType: AccessType.STANDARD, durationType: DurationType.PERMANENT, durationDays: null,
      justification:
        'Gestion quotidienne des réseaux sociaux du groupe (Facebook, Instagram, LinkedIn), veille concurrentielle et publication de contenus sur le site institutionnel. Poste nécessitant un accès permanent aux plateformes digitales.',
    }),
    status: RequestStatus.PENDING_MANAGER,
  });
  await backdate(AccessRequestModel, r3._id, daysAgo(3));
  await addHistory(r3, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: malek, date: daysAgo(3) },
  ]);

  // R4 — Ahmed, refusée par le chef IT
  const r4 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0004', requestType: RequestType.INTERNET_ACCESS,
      requester: ahmed, department: it, service: srvDev,
      accessType: AccessType.FULL, durationType: DurationType.PERMANENT, durationDays: null,
      justification: 'Accès à tous les sites sans restriction.',
    }),
    status: RequestStatus.REJECTED,
    managerDecisionBy: managerIt._id,
    managerDecisionAt: daysAgo(19),
    rejectionReason: 'Justification insuffisante pour un accès complet. Merci de préciser le besoin métier et de demander un accès standard.',
  });
  await backdate(AccessRequestModel, r4._id, daysAgo(20));
  await addHistory(r4, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: ahmed, date: daysAgo(20) },
    { action: 'Demande refusée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.REJECTED, performedBy: managerIt, comment: 'Justification insuffisante pour un accès complet.', date: daysAgo(19) },
  ]);

  // R5 — Malek, acceptée par le chef, en attente réseau
  const r5 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0005', requestType: RequestType.INTERNET_ACCESS,
      requester: malek, department: mkt, service: srvCom,
      accessType: AccessType.RESTRICTED, durationType: DurationType.TEMPORARY, durationDays: 60,
      justification:
        'Campagne de lancement du nouveau produit : accès aux plateformes publicitaires (Meta Ads, Google Ads) et aux outils de suivi statistique pendant la durée de la campagne.',
    }),
    status: RequestStatus.APPROVED_BY_MANAGER,
    managerDecisionBy: managerMkt._id,
    managerDecisionAt: daysAgo(4),
    managerComment: 'Campagne validée par la direction, accès nécessaire.',
  });
  await backdate(AccessRequestModel, r5._id, daysAgo(5));
  await addHistory(r5, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: malek, date: daysAgo(5) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: managerMkt, comment: 'Campagne validée par la direction, accès nécessaire.', date: daysAgo(4) },
  ]);

  // R6 — Rania, en cours de traitement par le réseau
  const r6 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0006', requestType: RequestType.INTERNET_ACCESS,
      requester: rania, department: rh, service: srvRecrut,
      accessType: AccessType.STANDARD, durationType: DurationType.PERMANENT, durationDays: null,
      justification:
        'Publication des offres d’emploi sur les jobboards (LinkedIn, Tanitjobs), consultation des profils candidats et gestion de la plateforme de formation en ligne des collaborateurs.',
    }),
    status: RequestStatus.IN_PROGRESS_NETWORK,
    managerDecisionBy: admin._id,
    managerDecisionAt: daysAgo(7),
    managerComment: 'Validée en l’absence de chef désigné pour le département RH.',
    processedBy: nabil._id,
  });
  await backdate(AccessRequestModel, r6._id, daysAgo(8));
  await addHistory(r6, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: rania, date: daysAgo(8) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: admin, comment: 'Validée en l’absence de chef désigné pour le département RH.', date: daysAgo(7) },
    { action: "Demande prise en charge par l'équipe réseau", fromStatus: RequestStatus.APPROVED_BY_MANAGER, toStatus: RequestStatus.IN_PROGRESS_NETWORK, performedBy: nabil, date: daysAgo(6) },
  ]);

  // R7 — Yassine, accès activé (expire dans 40 jours)
  const r7 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0007', requestType: RequestType.INTERNET_ACCESS,
      requester: yassine, department: fin, service: srvCompta,
      accessType: AccessType.STANDARD, durationType: DurationType.TEMPORARY, durationDays: 60,
      justification:
        'Télédéclaration fiscale mensuelle sur le portail de la DGI, accès au portail de la CNSS et téléchargement des relevés bancaires électroniques pour les rapprochements comptables.',
    }),
    status: RequestStatus.ACTIVATED,
    managerDecisionBy: admin._id,
    managerDecisionAt: daysAgo(23),
    managerComment: 'Besoin réglementaire récurrent.',
    processedBy: nabil._id,
    processedAt: daysAgo(20),
    networkComment: 'Profil proxy « standard-finance » appliqué au compte AD. Accès aux portails déclarés uniquement.',
    accessActivated: true,
    activationDate: daysAgo(20),
    expirationDate: daysFromNow(40),
  });
  await backdate(AccessRequestModel, r7._id, daysAgo(25));
  await addHistory(r7, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: yassine, date: daysAgo(25) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: admin, comment: 'Besoin réglementaire récurrent.', date: daysAgo(23) },
    { action: "Demande prise en charge par l'équipe réseau", fromStatus: RequestStatus.APPROVED_BY_MANAGER, toStatus: RequestStatus.IN_PROGRESS_NETWORK, performedBy: nabil, date: daysAgo(21) },
    { action: 'Accès Internet activé', fromStatus: RequestStatus.IN_PROGRESS_NETWORK, toStatus: RequestStatus.ACTIVATED, performedBy: nabil, comment: 'Profil proxy « standard-finance » appliqué au compte AD.', date: daysAgo(20) },
  ]);

  // R8 — Ahmed, demande traitée puis clôturée
  const r8 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0008', requestType: RequestType.INTERNET_ACCESS,
      requester: ahmed, department: it, service: srvDev,
      accessType: AccessType.RESTRICTED, durationType: DurationType.TEMPORARY, durationDays: 15,
      justification:
        'Accès temporaire au portail du prestataire cloud pour la migration du serveur de recette, dans le cadre du projet de refonte de l’infrastructure de test.',
    }),
    status: RequestStatus.CLOSED,
    managerDecisionBy: managerIt._id,
    managerDecisionAt: daysAgo(39),
    managerComment: 'OK pour la durée du projet uniquement.',
    processedBy: nabil._id,
    processedAt: daysAgo(38),
    networkComment: 'Accès liste blanche prestataire activé puis révoqué à la fin de la mission.',
    accessActivated: true,
    activationDate: daysAgo(38),
    expirationDate: daysAgo(23),
    closedAt: daysAgo(22),
  });
  await backdate(AccessRequestModel, r8._id, daysAgo(40));
  await addHistory(r8, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: ahmed, date: daysAgo(40) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: managerIt, comment: 'OK pour la durée du projet uniquement.', date: daysAgo(39) },
    { action: "Demande prise en charge par l'équipe réseau", fromStatus: RequestStatus.APPROVED_BY_MANAGER, toStatus: RequestStatus.IN_PROGRESS_NETWORK, performedBy: nabil, date: daysAgo(38, 10) },
    { action: 'Accès Internet activé', fromStatus: RequestStatus.IN_PROGRESS_NETWORK, toStatus: RequestStatus.ACTIVATED, performedBy: nabil, comment: 'Accès liste blanche prestataire activé.', date: daysAgo(38, 15) },
    { action: 'Demande clôturée', fromStatus: RequestStatus.ACTIVATED, toStatus: RequestStatus.CLOSED, performedBy: nabil, comment: 'Mission terminée, accès révoqué.', date: daysAgo(22) },
  ]);

  // R9 — Malek, accès expiré
  const r9 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-NET-2026-0009', requestType: RequestType.INTERNET_ACCESS,
      requester: malek, department: mkt, service: srvCom,
      accessType: AccessType.STANDARD, durationType: DurationType.TEMPORARY, durationDays: 30,
      justification:
        'Benchmark des sites concurrents et préparation du plan de communication trimestriel : accès temporaire aux sites d’analyse de trafic et aux plateformes de veille.',
    }),
    status: RequestStatus.EXPIRED,
    managerDecisionBy: managerMkt._id,
    managerDecisionAt: daysAgo(44),
    processedBy: nabil._id,
    processedAt: daysAgo(43),
    networkComment: 'Accès standard activé pour 30 jours.',
    accessActivated: true,
    activationDate: daysAgo(43),
    expirationDate: daysAgo(5),
    expiryReminderSent: true,
  });
  await backdate(AccessRequestModel, r9._id, daysAgo(45));
  await addHistory(r9, [
    { action: "Demande créée — Demande d'accès Internet", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: malek, date: daysAgo(45) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: managerMkt, date: daysAgo(44) },
    { action: "Demande prise en charge par l'équipe réseau", fromStatus: RequestStatus.APPROVED_BY_MANAGER, toStatus: RequestStatus.IN_PROGRESS_NETWORK, performedBy: nabil, date: daysAgo(43, 8) },
    { action: 'Accès Internet activé', fromStatus: RequestStatus.IN_PROGRESS_NETWORK, toStatus: RequestStatus.ACTIVATED, performedBy: nabil, comment: 'Accès standard activé pour 30 jours.', date: daysAgo(43, 11) },
    { action: 'Accès expiré (contrôle automatique)', fromStatus: RequestStatus.ACTIVATED, toStatus: RequestStatus.EXPIRED, performedBy: null, date: daysAgo(5) },
  ]);

  // ---------- Nouveaux types de formulaires ----------

  // R10 — Ahmed, accès à distance : le chef demande des modifications
  const r10 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-DIS-2026-0001', requestType: RequestType.REMOTE_ACCESS,
      requester: ahmed, department: it, service: srvDev,
      durationType: DurationType.TEMPORARY, durationDays: 30,
      justification:
        'Besoin de me connecter au serveur de recette depuis mon domicile pour finaliser la mise en production de l’application de gestion des stocks en dehors des heures ouvrées.',
      formData: {
        connectionMethod: 'VPN',
        targetResource: 'srv-recette-01 (application stocks)',
        remoteLocation: 'HOME',
        workstationId: 'PC-IT-042',
      },
    }),
    status: RequestStatus.CHANGES_REQUESTED,
    managerDecisionBy: managerIt._id,
    managerDecisionAt: daysAgo(3),
    managerComment:
      'Merci de préciser la période exacte d’intervention (dates) et de limiter la demande au seul serveur de recette, pas à tout le VLAN.',
  });
  await backdate(AccessRequestModel, r10._id, daysAgo(4));
  await addHistory(r10, [
    { action: "Demande créée — Demande d'accès à distance", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: ahmed, date: daysAgo(4) },
    { action: 'Modifications demandées par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.CHANGES_REQUESTED, performedBy: managerIt, comment: 'Merci de préciser la période exacte d’intervention et de limiter la demande au serveur de recette.', date: daysAgo(3) },
  ]);

  // R11 — Yassine (Finance : données sensibles), lecteur externe, en attente
  const r11 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-USB-2026-0001', requestType: RequestType.EXTERNAL_DRIVE,
      requester: yassine, department: fin, service: srvCompta,
      durationType: DurationType.TEMPORARY, durationDays: 7,
      justification:
        'Récupération des balances comptables de la filiale El Mazraa depuis une clé USB remise par le commissaire aux comptes, pour intégration dans l’ERP.',
      formData: {
        deviceType: 'USB_KEY',
        workstationId: 'PC-FIN-011',
        dataDescription: 'Balances comptables mensuelles de la filiale (fichiers Excel)',
        commitmentAccepted: true,
      },
    }),
    status: RequestStatus.PENDING_MANAGER,
  });
  await backdate(AccessRequestModel, r11._id, daysAgo(1));
  await addHistory(r11, [
    { action: "Demande créée — Engagement pour déverrouillage d'un lecteur externe", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: yassine, date: daysAgo(1) },
  ]);

  // R12 — Rania, partage réseau lecture seule, validée — file réseau
  const r12 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-PRT-2026-0001', requestType: RequestType.NETWORK_SHARE,
      requester: rania, department: rh, service: srvRecrut,
      durationType: DurationType.TEMPORARY, durationDays: 90,
      justification:
        'Consultation des dossiers de candidatures archivés par l’ancienne chargée de recrutement pour assurer la continuité des recrutements en cours.',
      formData: {
        sharePath: '\\\\srv-fichiers\\rh-recrutement',
        permissionLevel: 'READ_ONLY',
        shareOwnerDepartment: 'Ressources Humaines',
      },
    }),
    status: RequestStatus.APPROVED_BY_MANAGER,
    managerDecisionBy: admin._id,
    managerDecisionAt: daysAgo(5),
    managerComment: 'Accès lecture seule justifié par la passation de poste.',
  });
  await backdate(AccessRequestModel, r12._id, daysAgo(6));
  await addHistory(r12, [
    { action: "Demande créée — Demande d'accès à un partage réseau", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: rania, date: daysAgo(6) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: admin, comment: 'Accès lecture seule justifié par la passation de poste.', date: daysAgo(5) },
  ]);

  // R13 — Malek, clé 3G : refus TECHNIQUE par l'équipe réseau
  const r13 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-3G-2026-0001', requestType: RequestType.USB_3G_KEY,
      requester: malek, department: mkt, service: srvCom,
      durationType: DurationType.TEMPORARY, durationDays: 60,
      justification:
        'Couverture des salons professionnels et des visites en filiales : besoin d’une connexion Internet mobile pour publier en direct sur les réseaux sociaux du groupe.',
      formData: {
        simOperator: 'OOREDOO',
        workstationId: 'LT-MKT-007',
        usageLocation: 'Salons professionnels et visites des filiales',
      },
    }),
    status: RequestStatus.REJECTED_TECHNICAL,
    managerDecisionBy: managerMkt._id,
    managerDecisionAt: daysAgo(11),
    managerComment: 'Besoin réel pour les événements du trimestre.',
    processedBy: nabil._id,
    processedAt: daysAgo(9),
    networkComment:
      'Aucune clé 3G disponible en stock. Le partage de connexion sécurisé du smartphone professionnel couvre déjà ce besoin : demande refusée techniquement.',
    accessActivated: false,
    closedAt: daysAgo(9),
  });
  await backdate(AccessRequestModel, r13._id, daysAgo(12));
  await addHistory(r13, [
    { action: "Demande créée — Demande d'accès Internet via clé 3G", fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: malek, date: daysAgo(12) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: managerMkt, comment: 'Besoin réel pour les événements du trimestre.', date: daysAgo(11) },
    { action: "Demande prise en charge par l'équipe réseau", fromStatus: RequestStatus.APPROVED_BY_MANAGER, toStatus: RequestStatus.IN_PROGRESS_NETWORK, performedBy: nabil, date: daysAgo(10) },
    { action: "Refus technique par l'équipe réseau", fromStatus: RequestStatus.IN_PROGRESS_NETWORK, toStatus: RequestStatus.REJECTED_TECHNICAL, performedBy: nabil, comment: 'Aucune clé disponible ; besoin couvert par le partage de connexion sécurisé.', date: daysAgo(9) },
  ]);

  // R14 — Ahmed, fiche d'engagement du mot de passe : enregistrée
  const r14 = await AccessRequestModel.create({
    ...makeBase({
      reference: 'REQ-ENG-2026-0001', requestType: RequestType.PASSWORD_COMMITMENT,
      requester: ahmed, department: it, service: srvDev,
      durationType: DurationType.PERMANENT, durationDays: null,
      justification: 'Engagement de confidentialité relatif au mot de passe professionnel.',
      formData: {
        systemsConcerned: 'Session Windows, messagerie professionnelle, ERP du groupe',
        commitmentAccepted: true,
      },
    }),
    status: RequestStatus.ACTIVATED,
    managerDecisionBy: managerIt._id,
    managerDecisionAt: daysAgo(29),
    managerComment: 'Fiche conforme à la politique de sécurité du groupe.',
    processedBy: nabil._id,
    processedAt: daysAgo(28),
    networkComment: 'Fiche d’engagement enregistrée dans le référentiel sécurité.',
    accessActivated: true,
    activationDate: daysAgo(28),
    expirationDate: null,
  });
  await backdate(AccessRequestModel, r14._id, daysAgo(30));
  await addHistory(r14, [
    { action: 'Demande créée — Fiche d’engagement du mot de passe', fromStatus: null, toStatus: RequestStatus.PENDING_MANAGER, performedBy: ahmed, date: daysAgo(30) },
    { action: 'Demande acceptée par le chef de département', fromStatus: RequestStatus.PENDING_MANAGER, toStatus: RequestStatus.APPROVED_BY_MANAGER, performedBy: managerIt, comment: 'Fiche conforme à la politique de sécurité du groupe.', date: daysAgo(29) },
    { action: "Demande prise en charge par l'équipe réseau", fromStatus: RequestStatus.APPROVED_BY_MANAGER, toStatus: RequestStatus.IN_PROGRESS_NETWORK, performedBy: nabil, date: daysAgo(28, 9) },
    { action: 'Fiche d’engagement enregistrée', fromStatus: RequestStatus.IN_PROGRESS_NETWORK, toStatus: RequestStatus.ACTIVATED, performedBy: nabil, comment: 'Fiche enregistrée dans le référentiel sécurité.', date: daysAgo(28, 11) },
  ]);

  // ------------------------------------------------------------------
  // Messagerie interne (chef de département ↔ équipe réseau)
  // ------------------------------------------------------------------
  console.log('Création des échanges internes...');
  // Fil sur R5 (demande de Malek, département Marketing, validée par Sonia) :
  // Sonia (chef MKT) et Nabil (équipe réseau) sont les deux seuls à y avoir accès.
  const thread = await RequestThreadModel.create({
    request: r5._id,
    reference: r5.reference,
    requestType: r5.requestType,
    department: mkt._id,
    requesterName: `${malek.firstName} ${malek.lastName}`,
    status: ThreadStatus.OPEN,
    createdBy: nabil._id,
    messageCount: 3,
  });

  const threadMessages: {
    author: any;
    role: Role;
    body: string;
    readBy: any[];
    date: Date;
  }[] = [
    {
      author: nabil, role: Role.NETWORK_TEAM,
      body: 'Bonjour, avant d’ouvrir l’accès pour Malek Rahmouni : confirmez-vous que le profil de filtrage « Marketing » (réseaux sociaux autorisés) suffit, ou faut-il également les plateformes publicitaires ?',
      readBy: [nabil, managerMkt], date: daysAgo(4, 10),
    },
    {
      author: managerMkt, role: Role.MANAGER,
      body: 'Bonjour Nabil, le profil Marketing suffit pour l’instant. Les plateformes publicitaires feront l’objet d’une demande séparée en septembre.',
      readBy: [managerMkt, nabil], date: daysAgo(4, 11),
    },
    {
      author: nabil, role: Role.NETWORK_TEAM,
      body: 'Parfait, je pars sur le profil Marketing. Activation prévue demain matin, je vous confirme dès que c’est en place.',
      readBy: [nabil], date: daysAgo(3, 16),
    },
  ];

  for (const message of threadMessages) {
    const created = await RequestMessageModel.create({
      thread: thread._id,
      request: r5._id,
      department: mkt._id,
      author: message.author._id,
      authorRole: message.role,
      body: message.body,
      readBy: message.readBy.map((user: any) => user._id),
    });
    await backdate(RequestMessageModel, created._id, message.date);
  }

  const lastMessage = threadMessages[threadMessages.length - 1];
  thread.lastMessageAt = lastMessage.date;
  thread.lastMessagePreview = lastMessage.body.slice(0, 140);
  thread.lastMessageBy = nabil._id;
  await thread.save();
  await backdate(RequestThreadModel, thread._id, daysAgo(4, 10));

  // ------------------------------------------------------------------
  // Notifications
  // ------------------------------------------------------------------
  console.log('Création des notifications...');
  const notifications = await NotificationModel.create([
    { recipient: managerIt._id, type: NotificationType.REQUEST_SUBMITTED, title: 'Nouvelle demande à valider', message: `Ahmed Amine Drira a soumis « Demande d'accès Internet » (${r1.reference}, département Informatique).`, relatedRequest: r1._id, isRead: false },
    { recipient: managerIt._id, type: NotificationType.REQUEST_SUBMITTED, title: 'Nouvelle demande à valider', message: `Ahmed Amine Drira a soumis « Demande d'accès Internet » (${r2.reference}, département Informatique).`, relatedRequest: r2._id, isRead: false },
    { recipient: managerMkt._id, type: NotificationType.REQUEST_SUBMITTED, title: 'Nouvelle demande à valider', message: `Malek Rahmouni a soumis « Demande d'accès Internet » (${r3.reference}, département Marketing).`, relatedRequest: r3._id, isRead: false },
    { recipient: nabil._id, type: NotificationType.REQUEST_APPROVED, title: 'Nouvelle demande à traiter', message: `La demande ${r5.reference} (Malek Rahmouni) a été validée et attend une vérification technique.`, relatedRequest: r5._id, isRead: false },
    { recipient: ahmed._id, type: NotificationType.REQUEST_REJECTED, title: 'Demande refusée', message: `Votre demande ${r4.reference} a été refusée. Motif : justification insuffisante pour un accès complet.`, relatedRequest: r4._id, isRead: true, readAt: daysAgo(18) },
    { recipient: yassine._id, type: NotificationType.REQUEST_ACTIVATED, title: 'Accès Internet activé', message: `Votre accès Internet (${r7.reference}) est actif jusqu'au ${r7.expirationDate?.toLocaleDateString('fr-FR')}.`, relatedRequest: r7._id, isRead: false },
    { recipient: malek._id, type: NotificationType.REQUEST_EXPIRED, title: 'Accès Internet expiré', message: `Votre accès Internet (${r9.reference}) est arrivé à expiration. Soumettez une nouvelle demande si nécessaire.`, relatedRequest: r9._id, isRead: false },
    { recipient: ahmed._id, type: NotificationType.REQUEST_CHANGES_REQUESTED, title: 'Modifications demandées', message: `Le chef de département demande des modifications sur votre demande ${r10.reference} : précisez la période exacte et limitez la demande au serveur de recette.`, relatedRequest: r10._id, isRead: false },
    { recipient: admin._id, type: NotificationType.REQUEST_SUBMITTED, title: 'Nouvelle demande à valider (département sans chef)', message: `Yassine Jlassi a soumis « Engagement pour déverrouillage d'un lecteur externe » (${r11.reference}, département Finance et Contrôle de Gestion).`, relatedRequest: r11._id, isRead: false },
    { recipient: nabil._id, type: NotificationType.REQUEST_APPROVED, title: 'Nouvelle demande à traiter', message: `La demande ${r12.reference} (partage réseau — Rania Khelifi) a été validée et attend une vérification technique.`, relatedRequest: r12._id, isRead: false },
    { recipient: malek._id, type: NotificationType.REQUEST_REJECTED_TECHNICAL, title: 'Refus technique', message: `Votre demande ${r13.reference} (clé 3G) a été refusée lors de la vérification technique : aucune clé disponible.`, relatedRequest: r13._id, isRead: true, readAt: daysAgo(8) },
  ]);
  const notificationDates = [
    daysAgo(2), daysAgo(1, 14), daysAgo(3), daysAgo(4), daysAgo(19),
    daysAgo(20), daysAgo(5), daysAgo(3), daysAgo(1), daysAgo(5), daysAgo(9),
  ];
  await Promise.all(
    notifications.map((notification, index) =>
      backdate(NotificationModel, notification._id, notificationDates[index]),
    ),
  );

  // ------------------------------------------------------------------
  // Journal d'audit
  // ------------------------------------------------------------------
  console.log("Création du journal d'audit...");
  const auditEntries = [
    { user: superAdmin._id, userEmail: superAdmin.email, action: AuditAction.USER_INVITED, ipAddress: '10.20.1.2', details: { cible: admin.email, role: Role.ADMIN }, date: daysAgo(60) },
    { user: admin._id, userEmail: admin.email, action: AuditAction.USER_CREATED, ipAddress: '10.20.1.5', details: { cible: ahmed.email, role: Role.EMPLOYEE }, date: daysAgo(50) },
    { user: admin._id, userEmail: admin.email, action: AuditAction.USER_CREATED, ipAddress: '10.20.1.5', details: { cible: nabil.email, role: Role.NETWORK_TEAM }, date: daysAgo(50, 10) },
    { user: admin._id, userEmail: admin.email, action: AuditAction.USER_INVITED, ipAddress: '10.20.1.5', details: { cible: pendingEmployee.email, role: Role.EMPLOYEE }, date: daysAgo(1) },
    { user: superAdmin._id, userEmail: superAdmin.email, action: AuditAction.FORM_UPDATED, ipAddress: '10.20.1.2', details: { formulaire: RequestType.NETWORK_SHARE, version: 1 }, date: daysAgo(30) },
    { user: nabil._id, userEmail: nabil.email, action: AuditAction.MESSAGE_SENT, ipAddress: '10.20.1.40', details: { reference: r5.reference, taille: 168 }, date: daysAgo(4, 10) },
    { user: ahmed._id, userEmail: ahmed.email, action: AuditAction.LOGIN_SUCCESS, ipAddress: '10.20.4.32', details: {}, date: daysAgo(2, 8) },
    { user: ahmed._id, userEmail: ahmed.email, action: AuditAction.REQUEST_CREATED, ipAddress: '10.20.4.32', details: { reference: r1.reference, typeFormulaire: RequestType.INTERNET_ACCESS }, date: daysAgo(2) },
    { user: managerIt._id, userEmail: managerIt.email, action: AuditAction.LOGIN_SUCCESS, ipAddress: '10.20.2.11', details: {}, date: daysAgo(19, 8) },
    { user: managerIt._id, userEmail: managerIt.email, action: AuditAction.REQUEST_REJECTED, ipAddress: '10.20.2.11', details: { reference: r4.reference, motif: 'Justification insuffisante' }, date: daysAgo(19) },
    { user: managerIt._id, userEmail: managerIt.email, action: AuditAction.REQUEST_CHANGES_REQUESTED, ipAddress: '10.20.2.11', details: { reference: r10.reference }, date: daysAgo(3) },
    { user: managerMkt._id, userEmail: managerMkt.email, action: AuditAction.REQUEST_APPROVED, ipAddress: '10.20.3.7', details: { reference: r5.reference }, date: daysAgo(4) },
    { user: nabil._id, userEmail: nabil.email, action: AuditAction.REQUEST_TAKEN_IN_CHARGE, ipAddress: '10.20.1.40', details: { reference: r6.reference }, date: daysAgo(6) },
    { user: nabil._id, userEmail: nabil.email, action: AuditAction.REQUEST_PROCESSED, ipAddress: '10.20.1.40', details: { reference: r7.reference, accesActive: true }, date: daysAgo(20) },
    { user: nabil._id, userEmail: nabil.email, action: AuditAction.REQUEST_REJECTED_TECHNICAL, ipAddress: '10.20.1.40', details: { reference: r13.reference, motif: 'Aucune clé 3G disponible' }, date: daysAgo(9) },
    { user: null, userEmail: 'système', action: AuditAction.REQUEST_EXPIRED, ipAddress: '', details: { reference: r9.reference }, date: daysAgo(5) },
    { user: null, userEmail: 'inconnu@poulina.tn', action: AuditAction.LOGIN_FAILED, ipAddress: '10.20.9.99', details: { raison: 'Email inconnu' }, date: daysAgo(1, 22) },
  ];
  for (const entry of auditEntries) {
    const log = await AuditLogModel.create({
      user: entry.user,
      userEmail: entry.userEmail,
      action: entry.action,
      ipAddress: entry.ipAddress,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      details: entry.details,
    });
    await backdate(AuditLogModel, log._id, entry.date);
  }

  // ------------------------------------------------------------------
  // Récapitulatif
  // ------------------------------------------------------------------
  const counts = {
    utilisateurs: await UserModel.countDocuments(),
    departements: await DepartmentModel.countDocuments(),
    services: await ServiceModel.countDocuments(),
    formulaires: await FormDefinitionModel.countDocuments(),
    demandes: await AccessRequestModel.countDocuments(),
    historique: await RequestHistoryModel.countDocuments(),
    filsDiscussion: await RequestThreadModel.countDocuments(),
    messages: await RequestMessageModel.countDocuments(),
    notifications: await NotificationModel.countDocuments(),
    auditLogs: await AuditLogModel.countDocuments(),
  };

  console.log('\n=== Base de démonstration créée avec succès ===');
  console.table(counts);
  console.log('Comptes de démonstration :');
  console.table([
    { Role: 'Super administrateur', Email: 'superadmin@poulina.tn', MotDePasse: 'Super@2026' },
    { Role: 'Administrateur', Email: 'admin@poulina.tn', MotDePasse: 'Admin@2026' },
    { Role: 'Chef département IT', Email: 'manager.it@poulina.tn', MotDePasse: 'Manager@2026' },
    { Role: 'Chef département MKT', Email: 'manager.mkt@poulina.tn', MotDePasse: 'Manager@2026' },
    { Role: 'Employé (IT)', Email: 'employee@poulina.tn', MotDePasse: 'Employee@2026' },
    { Role: 'Employé (MKT)', Email: 'malek.rahmouni@poulina.tn', MotDePasse: 'Employee@2026' },
    { Role: 'Équipe réseau', Email: 'network@poulina.tn', MotDePasse: 'Network@2026' },
    { Role: 'Responsable sécurité', Email: 'security@poulina.tn', MotDePasse: 'Security@2026' },
  ]);
  console.log(
    `Compte en attente d'activation : ${pendingEmployee.email} — générez son lien depuis ` +
      'Utilisateurs → « Lien d’accès » (scénario d’arrivée d’un nouvel employé).',
  );
}

seed()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Échec du seed :', error);
    await mongoose.disconnect();
    process.exit(1);
  });

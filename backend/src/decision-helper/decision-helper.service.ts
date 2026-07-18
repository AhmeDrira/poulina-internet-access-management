import { Injectable } from '@nestjs/common';
import {
  AccessType,
  DurationType,
  RecommendationLevel,
  RequestType,
} from '../common/enums';

export interface DecisionInput {
  requestType: RequestType;
  justification: string;
  accessType?: AccessType | null;
  durationType: DurationType;
  durationDays?: number | null;
  departmentName?: string;
  /** Champs spécifiques du formulaire (permissionLevel, deviceType...) */
  formData?: Record<string, unknown>;
  /** Nombre de demandes précédentes du demandeur refusées */
  previousRejectedCount?: number;
}

export interface DecisionResult {
  score: number;
  level: RecommendationLevel;
  reasons: string[];
}

/**
 * Module d'aide à la décision basé sur des règles simples.
 * Il fournit une RECOMMANDATION au chef de département :
 * il ne décide jamais automatiquement à sa place.
 * Les règles tiennent compte du TYPE de formulaire : un déverrouillage
 * de lecteur externe dans un département manipulant des données sensibles
 * n'a pas le même niveau de risque qu'une fiche d'engagement.
 */
@Injectable()
export class DecisionHelperService {
  /** Départements dont le besoin d'accès Internet est fréquent et attendu */
  private static readonly HIGH_NEED_DEPARTMENTS =
    /informatique|réseau|reseau|systèmes|systemes|\bit\b|\bsi\b|marketing|finance|communication/i;

  /** Départements manipulant des données sensibles (chiffres, paie, données du groupe) */
  private static readonly SENSITIVE_DATA_DEPARTMENTS =
    /contr[oô]le de gestion|finance|comptab|tr[eé]sorerie|ressources humaines|\brh\b|paie|audit/i;

  evaluate(input: DecisionInput): DecisionResult {
    let score = 50;
    const reasons: string[] = [];
    const justification = (input.justification ?? '').trim();
    const formData = input.formData ?? {};

    // --- Règles sur la justification (tous les formulaires) ---
    if (input.requestType !== RequestType.PASSWORD_COMMITMENT) {
      if (justification.length === 0) {
        score -= 30;
        reasons.push('Justification absente');
      } else if (justification.length < 20) {
        score -= 25;
        reasons.push('Justification trop courte (moins de 20 caractères)');
      } else if (justification.length >= 100) {
        score += 10;
        reasons.push('Justification détaillée fournie');
      }
    }

    // --- Règles sur la durée (tous les formulaires sauf fiche d'engagement) ---
    if (input.requestType !== RequestType.PASSWORD_COMMITMENT) {
      if (input.durationType === DurationType.PERMANENT) {
        score -= 15;
        reasons.push('Durée permanente demandée : à vérifier avec le poste');
      } else if (input.durationDays != null) {
        if (input.durationDays > 180) {
          score -= 10;
          reasons.push('Durée temporaire longue (plus de 6 mois)');
        } else if (input.durationDays <= 30) {
          score += 10;
          reasons.push('Durée courte (30 jours ou moins) : risque limité');
        }
      }
    }

    // --- Règles spécifiques au type de formulaire ---
    switch (input.requestType) {
      case RequestType.INTERNET_ACCESS:
        if (input.accessType === AccessType.FULL) {
          score -= 20;
          reasons.push("Type d'accès complet demandé : demande sensible");
        } else if (input.accessType === AccessType.RESTRICTED) {
          score += 10;
          reasons.push('Accès restreint : périmètre limité, risque faible');
        }
        if (
          input.departmentName &&
          DecisionHelperService.HIGH_NEED_DEPARTMENTS.test(input.departmentName)
        ) {
          score += 15;
          reasons.push(
            `Département "${input.departmentName}" : besoin métier d'Internet fréquent`,
          );
        }
        break;

      case RequestType.REMOTE_ACCESS:
        if (input.durationType === DurationType.PERMANENT) {
          score -= 10;
          reasons.push('Accès à distance permanent : surface d’attaque durable');
        }
        if (formData['connectionMethod'] === 'OTHER') {
          score -= 10;
          reasons.push('Méthode de connexion non standard : vérification technique requise');
        }
        break;

      case RequestType.EXTERNAL_DRIVE:
        if (
          input.departmentName &&
          DecisionHelperService.SENSITIVE_DATA_DEPARTMENTS.test(input.departmentName)
        ) {
          score -= 20;
          reasons.push(
            `Département "${input.departmentName}" manipule des données sensibles : lecteur externe à risque d'extraction`,
          );
        }
        if (input.durationType === DurationType.PERMANENT) {
          score -= 15;
          reasons.push('Déverrouillage permanent d’un lecteur externe : fortement déconseillé');
        }
        if (formData['commitmentAccepted'] === true) {
          score += 10;
          reasons.push('Engagement d’usage professionnel signé par le demandeur');
        }
        break;

      case RequestType.NETWORK_SHARE:
        if (formData['permissionLevel'] === 'READ_WRITE') {
          score -= 10;
          reasons.push('Accès en écriture demandé sur le partage : impact possible sur les données');
        } else if (formData['permissionLevel'] === 'READ_ONLY') {
          score += 10;
          reasons.push('Accès en lecture seule : risque limité');
        }
        if (
          input.departmentName &&
          DecisionHelperService.SENSITIVE_DATA_DEPARTMENTS.test(input.departmentName) &&
          formData['permissionLevel'] === 'READ_WRITE'
        ) {
          score -= 10;
          reasons.push('Écriture sur un partage depuis un département à données sensibles');
        }
        break;

      case RequestType.USB_3G_KEY:
        if (input.durationType === DurationType.PERMANENT) {
          score -= 10;
          reasons.push('Clé 3G permanente : contourne durablement le proxy du groupe');
        }
        if (
          input.departmentName &&
          DecisionHelperService.HIGH_NEED_DEPARTMENTS.test(input.departmentName)
        ) {
          score += 10;
          reasons.push(`Département "${input.departmentName}" : mobilité métier plausible`);
        }
        break;

      case RequestType.PASSWORD_COMMITMENT:
        score += 25;
        reasons.push('Fiche d’engagement : démarche de conformité, risque faible');
        if (formData['commitmentAccepted'] === true) {
          score += 10;
          reasons.push('Engagement de confidentialité accepté');
        }
        break;
    }

    // --- Historique du demandeur ---
    if ((input.previousRejectedCount ?? 0) > 0) {
      score -= 10;
      reasons.push(
        `${input.previousRejectedCount} demande(s) précédente(s) refusée(s) pour ce demandeur`,
      );
    }

    score = Math.max(0, Math.min(100, score));

    let level: RecommendationLevel;
    if (score >= 65) {
      level = RecommendationLevel.LIKELY_LEGITIMATE;
    } else if (score >= 40) {
      level = RecommendationLevel.NEEDS_REVIEW;
    } else {
      level = RecommendationLevel.RISKY;
    }

    return { score, level, reasons };
  }
}

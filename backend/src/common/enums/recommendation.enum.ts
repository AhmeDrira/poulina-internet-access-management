export enum RecommendationLevel {
  /** Score élevé — demande probablement légitime */
  LIKELY_LEGITIMATE = 'LIKELY_LEGITIMATE',
  /** Score moyen — demande à vérifier */
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  /** Score faible — demande risquée ou insuffisamment justifiée */
  RISKY = 'RISKY',
}

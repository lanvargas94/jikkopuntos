/**
 * Políticas de recompensa por formulario (extensible sin romper API).
 * Futuro: persistir en FormDefinition.pointsRewardPolicy o tabla de reglas.
 */
export const JIKKO_FORM_REWARD_POLICY = {
  /** Solo el primer envío del colaborador en este formulario recibe puntos. */
  FIRST_SUBMISSION_ONLY: 'FIRST_SUBMISSION_ONLY',
  /** Futuro: cada envío acredita (riesgo de abuso; usar con puntos 0 o límites). */
  // PER_SUBMISSION: 'PER_SUBMISSION',
} as const;

export type JikkoFormRewardPolicyCode =
  (typeof JIKKO_FORM_REWARD_POLICY)[keyof typeof JIKKO_FORM_REWARD_POLICY];

/** Cuántos puntos otorgar según política y contexto (número de envíos previos del usuario). */
export function evaluateFormRewardAmount(
  policy: JikkoFormRewardPolicyCode,
  configuredPoints: number,
  priorSubmissionCount: number,
): number {
  const pts = Math.max(0, Math.floor(configuredPoints));
  if (pts <= 0) {
    return 0;
  }
  switch (policy) {
    case JIKKO_FORM_REWARD_POLICY.FIRST_SUBMISSION_ONLY:
      return priorSubmissionCount === 0 ? pts : 0;
    default:
      return 0;
  }
}

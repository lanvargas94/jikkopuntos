/** Tipo de movimiento para UI y reglas de negocio */
export const JIKKO_MOVEMENT_TYPE = {
  FORM_REWARD: 'FORM_REWARD',
  ADMIN_CREDIT: 'ADMIN_CREDIT',
  ADMIN_DEBIT: 'ADMIN_DEBIT',
  ADJUSTMENT: 'ADJUSTMENT',
  /** Canje administrado: medio día de descanso (coste en JP según política). */
  REDEEM_REST_HALF_DAY: 'REDEEM_REST_HALF_DAY',
  /** Canje administrado: día completo de descanso. */
  REDEEM_REST_FULL_DAY: 'REDEEM_REST_FULL_DAY',
  /** Canje de beneficio por colaborador (catálogo por nivel de JP). */
  REDEEM_BENEFIT: 'REDEEM_BENEFIT',
} as const;

export type JikkoMovementType =
  (typeof JIKKO_MOVEMENT_TYPE)[keyof typeof JIKKO_MOVEMENT_TYPE];

export const JIKKO_SOURCE_TYPE = {
  /** Movimiento originado por un formulario (sourceId = FormDefinition.id). */
  FORM_DEFINITION: 'FORM_DEFINITION',
  FORM_RESPONSE: 'FORM_RESPONSE',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
  /** Canje de beneficio; sourceId = id del nivel (p. ej. T1000). */
  BENEFIT_TIER: 'BENEFIT_TIER',
} as const;

export type JikkoSourceType =
  (typeof JIKKO_SOURCE_TYPE)[keyof typeof JIKKO_SOURCE_TYPE];

export function movementTypeLabel(code: string): string {
  const labels: Record<string, string> = {
    [JIKKO_MOVEMENT_TYPE.FORM_REWARD]: 'Recompensa por formulario',
    [JIKKO_MOVEMENT_TYPE.ADMIN_CREDIT]: 'Abono (administración)',
    [JIKKO_MOVEMENT_TYPE.ADMIN_DEBIT]: 'Cargo (administración)',
    [JIKKO_MOVEMENT_TYPE.ADJUSTMENT]: 'Ajuste',
    [JIKKO_MOVEMENT_TYPE.REDEEM_REST_HALF_DAY]: 'Canje: medio día de descanso',
    [JIKKO_MOVEMENT_TYPE.REDEEM_REST_FULL_DAY]: 'Canje: día completo de descanso',
    [JIKKO_MOVEMENT_TYPE.REDEEM_BENEFIT]: 'Canje de beneficio',
  };
  return labels[code] ?? code;
}

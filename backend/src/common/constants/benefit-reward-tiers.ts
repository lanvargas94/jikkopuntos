/**
 * Catálogo MVP de beneficios canjeables por jikkopuntos (alineado al portal colaborador).
 * El umbral mínimo para habilitar el módulo es el JP del nivel más bajo.
 */
export const BENEFIT_REWARD_TIERS = [
  { id: 'T1000', jp: 1000, label: 'Kit de bienvenida Jikkosoft' },
  { id: 'T2000', jp: 2000, label: 'Bonificación cafetería' },
  { id: 'T3000', jp: 3000, label: 'Tarjeta regalo Amazon $100' },
  { id: 'T5000', jp: 5000, label: 'Experiencia wellness premium' },
  { id: 'T10000', jp: 10000, label: 'Reconocimiento anual destacado' },
] as const;

export type BenefitTierId = (typeof BENEFIT_REWARD_TIERS)[number]['id'];

export const BENEFIT_MIN_JP_TO_UNLOCK = Math.min(
  ...BENEFIT_REWARD_TIERS.map((t) => t.jp),
);

export const BENEFIT_TIER_IDS: BenefitTierId[] = BENEFIT_REWARD_TIERS.map(
  (t) => t.id,
);

export function getBenefitTierById(id: string) {
  return BENEFIT_REWARD_TIERS.find((t) => t.id === id);
}

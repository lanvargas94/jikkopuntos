import { JIKKO_MOVEMENT_TYPE } from '../../../common/constants/jikkopoint-movement';

export const REDEEM_REST_KIND = {
  REST_HALF_DAY: 'REST_HALF_DAY',
  REST_FULL_DAY: 'REST_FULL_DAY',
} as const;

export type RedeemRestKind = (typeof REDEEM_REST_KIND)[keyof typeof REDEEM_REST_KIND];

/** Costes en JP (MVP; ajustables con política de RR.HH.). */
export const REDEEM_REST_CONFIG: Record<
  RedeemRestKind,
  { jp: number; label: string; movementType: string }
> = {
  [REDEEM_REST_KIND.REST_HALF_DAY]: {
    jp: 500,
    label: 'Medio día de descanso',
    movementType: JIKKO_MOVEMENT_TYPE.REDEEM_REST_HALF_DAY,
  },
  [REDEEM_REST_KIND.REST_FULL_DAY]: {
    jp: 1000,
    label: 'Día completo de descanso',
    movementType: JIKKO_MOVEMENT_TYPE.REDEEM_REST_FULL_DAY,
  },
};

export const REDEMPTION_TYPE = {
  BENEFIT: 'BENEFIT',
  REST: 'REST',
} as const;

export type RedemptionType = (typeof REDEMPTION_TYPE)[keyof typeof REDEMPTION_TYPE];

export const REDEMPTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type RedemptionStatus =
  (typeof REDEMPTION_STATUS)[keyof typeof REDEMPTION_STATUS];

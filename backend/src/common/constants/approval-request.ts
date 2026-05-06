export const APPROVAL_CATEGORY = {
  JIKKOPOINTS_REDEMPTION: 'JIKKOPOINTS_REDEMPTION',
  LEAVE_PERMISSION: 'LEAVE_PERMISSION',
  MEDICAL_LEAVE: 'MEDICAL_LEAVE',
} as const;

export type ApprovalCategory =
  (typeof APPROVAL_CATEGORY)[keyof typeof APPROVAL_CATEGORY];

export const APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ApprovalStatus =
  (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export const LEAVE_KIND = {
  PERSONAL: 'PERSONAL',
  STUDY: 'STUDY',
  MEDICAL_APPOINTMENT: 'MEDICAL_APPOINTMENT',
  FAMILY: 'FAMILY',
  OTHER: 'OTHER',
} as const;

export type LeaveKind = (typeof LEAVE_KIND)[keyof typeof LEAVE_KIND];

export const LEAVE_KIND_LABEL: Record<string, string> = {
  [LEAVE_KIND.PERSONAL]: 'Personal',
  [LEAVE_KIND.STUDY]: 'Estudio',
  [LEAVE_KIND.MEDICAL_APPOINTMENT]: 'Cita médica',
  [LEAVE_KIND.FAMILY]: 'Familia',
  [LEAVE_KIND.OTHER]: 'Otro',
};

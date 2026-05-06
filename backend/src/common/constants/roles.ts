export const ROLE_CODES = {
  ADMIN: 'ADMIN',
  COLLABORATOR: 'COLLABORATOR',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];
